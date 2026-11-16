import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { Socket, Namespace } from 'socket.io';
import { DatabaseService } from '../db/database.service';
import { AccessService } from './access.service';
import { RealtimeGateway } from './realtime.gateway';

describe('Seguridad del canal médico', () => {
  const id = randomUUID();
  const jwt = new JwtService({ secret: randomBytes(48).toString('hex') });
  const query = jest.fn();
  const access = new AccessService(jwt, { query } as unknown as DatabaseService);
  beforeEach(() => { query.mockResolvedValue({ rows: [{ id }] }); });
  it('no admite JWT sin expiración, con sujeto inválido o audiencias distintas', async () => {
    for (const payload of [{ sub: id, role: 'MEDICO' },
      { sub: 'invalid', role: 'MEDICO', exp: Math.floor(Date.now()/1000)+900 }]) {
      const token = jwt.sign(payload, { issuer: 'sit-cama-api', audience: 'sit-cama-client' });
      await expect(access.socketToken(token)).rejects.toThrow();
    }
    await expect(access.socketToken(jwt.sign({ sub: id, role: 'MEDICO' }, { expiresIn: 900, audience: 'other' }))).rejects.toThrow();
    await expect(access.socketToken('x'.repeat(4097))).rejects.toThrow();
  });
  it('si falla una reautorización no permite sync ni entrega datos', async () => {
    const gateway = new RealtimeGateway(access);
    const socket = { data: { token: 'invalid' }, disconnect: jest.fn(), emit: jest.fn() } as unknown as Socket;
    expect(await gateway.sync(socket)).toEqual({ ok: false });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    gateway.server = { sockets: new Map([['test', socket]]) } as unknown as Namespace;
    await gateway.notify(true); expect(socket.emit).not.toHaveBeenCalled();
    gateway.handleDisconnect(socket); expect(socket.data.token).toBeUndefined();
    gateway.onModuleDestroy();
  });
});
