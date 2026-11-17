import { OnModuleDestroy } from '@nestjs/common';
import { OnGatewayInit, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer, ConnectedSocket } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { corsOrigins } from '../configure-app';
import { AccessService } from './access.service';

export function permittedOrigin(origin: string | undefined): boolean {
  return origin === undefined || corsOrigins(process.env).includes(origin);
}

@WebSocketGateway({
  namespace: '/triage', transports: ['websocket'], maxHttpBufferSize: 4096,
  cors: { origin: (origin, done) => done(null, permittedOrigin(origin)) },
  allowRequest: (request, done) => done(null, permittedOrigin(request.headers.origin)),
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server!: Namespace;
  private readonly expiry = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private readonly access: AccessService) {}

  afterInit(server: Namespace) {
    server.use(async (socket, next) => {
      try {
        const user = await this.access.socketToken(socket.handshake.auth?.token);
        socket.data.token = socket.handshake.auth.token;
        this.expiry.set(socket.id, setTimeout(() => socket.disconnect(true),
          Math.min(user.expires - Date.now(), 2147483647)));
        socket.use(async ([event, body], done) => {
          try {
            await this.authorize(socket);
            if (event !== 'triage:sync' || !body || Array.isArray(body) ||
              typeof body !== 'object' || Object.keys(body).length) throw new Error();
            done();
          } catch { socket.disconnect(true); done(new Error('Acceso denegado')); }
        });
        next();
      } catch { next(new Error('Acceso denegado')); }
    });
  }

  private async authorize(socket: Socket) {
    return this.access.socketToken(socket.data.token);
  }

  @SubscribeMessage('triage:sync')
  async sync(@ConnectedSocket() socket: Socket) {
    try { await this.authorize(socket); return { ok: true }; }
    catch { socket.disconnect(true); return { ok: false }; }
  }

  // Called only after a successful COMMIT. No patient identifiers or clinical payload.
  async notify(criticalDemo: boolean): Promise<void> {
    const event = { eventId: randomUUID(), criticalDemo };
    for (const socket of this.server?.sockets.values() ?? []) {
      try { await this.authorize(socket); socket.emit('triage:changed', event); }
      catch { socket.disconnect(true); }
    }
  }

  handleDisconnect(socket: Socket) {
    clearTimeout(this.expiry.get(socket.id));
    this.expiry.delete(socket.id);
    delete socket.data.token;
  }

  onModuleDestroy() {
    for (const timer of this.expiry.values()) clearTimeout(timer);
    this.expiry.clear();
  }
}
