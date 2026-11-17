import { inject, Injectable, NgZone, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Subject } from 'rxjs';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

import { API_BASE_URL, EMULATOR_API_URL } from './api-config';
import { NativeRuntimeService } from './native-runtime.service';
import { SessionService } from './session.service';

interface Notice {
  eventId: string;
  criticalDemo: boolean;
}
interface NativeRealtime {
  connect(options: { token: string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(event: 'state', listener: (event: { status: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'changed', listener: (event: Notice) => void): Promise<PluginListenerHandle>;
}
const native = registerPlugin<NativeRealtime>('SitcamaRealtime');
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly base = inject(API_BASE_URL);
  private readonly runtime = inject(NativeRuntimeService);
  private readonly session = inject(SessionService);
  private readonly zone = inject(NgZone);
  private socket?: Socket;
  private generation = 0;
  private nativeActive = false;
  private nativeTasks: Promise<void> = Promise.resolve();
  private handles: PluginListenerHandle[] = [];
  private readonly seen = new Set<string>();
  private readonly changed = new Subject<Notice>();
  private readonly connected = new Subject<void>();
  readonly changed$ = this.changed.asObservable();
  readonly connected$ = this.connected.asObservable();
  readonly status = signal('Desconectado');
  constructor() {
    this.session.ended$.subscribe(() => this.stop());
  }

  async start(): Promise<void> {
    this.stop();
    if (!this.session.isValid() || this.session.role() !== 'MEDICO' || !this.base) return;
    const generation = this.generation;
    this.status.set('Conectando');
    if (Capacitor.isNativePlatform() && this.base === EMULATOR_API_URL && this.runtime.debuggable) {
      this.nativeActive = true;
      try {
        const handles = await Promise.all([
          native.addListener('state', (event) =>
            this.zone.run(() => {
              if (generation !== this.generation) return;
              if (event.status === 'connected') this.online();
              else this.status.set(event.status === 'denied' ? 'Acceso rechazado' : 'Reconectando');
            }),
          ),
          native.addListener('changed', (event) =>
            this.zone.run(() => {
              if (generation === this.generation) this.receive(event);
            }),
          ),
        ]);
        if (generation !== this.generation) {
          await Promise.all(handles.map((h) => h.remove()));
          return;
        }
        this.handles = handles;
        const token = this.session.token()!;
        this.nativeTasks = this.nativeTasks.then(async () => {
          if (generation === this.generation) await native.connect({ token });
        });
        await this.nativeTasks;
      } catch {
        if (generation === this.generation) this.status.set('Sin conexión en vivo');
      }
      return;
    }
    const socket = io(`${new URL(this.base).origin}/triage`, {
      auth: { token: this.session.token() },
      transports: ['websocket'],
      forceNew: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    this.socket = socket;
    socket.on('connect', () => {
      socket.emit('triage:sync', {});
      this.zone.run(() => this.online());
    });
    socket.on('triage:changed', (event: unknown) => this.zone.run(() => this.receive(event)));
    socket.on('disconnect', (reason) =>
      this.zone.run(() => this.status.set(reason === 'io server disconnect' ? 'Acceso rechazado' : 'Reconectando')),
    );
    socket.on('connect_error', () => this.zone.run(() => this.status.set('Sin conexión en vivo')));
  }
  private online(): void {
    this.status.set('En vivo');
    this.connected.next();
  }
  private receive(value: unknown): void {
    const event = value as Partial<Notice> | null;
    if (
      !event ||
      typeof event.eventId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(event.eventId) ||
      typeof event.criticalDemo !== 'boolean' ||
      this.seen.has(event.eventId)
    )
      return;
    this.seen.add(event.eventId);
    if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value!);
    this.changed.next({ eventId: event.eventId, criticalDemo: event.criticalDemo });
  }
  stop(): void {
    this.generation++;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
    if (this.nativeActive)
      this.nativeTasks = this.nativeTasks
        .catch(() => undefined)
        .then(() => native.disconnect())
        .catch(() => undefined);
    this.nativeActive = false;
    for (const handle of this.handles) void handle.remove();
    this.handles = [];
    this.seen.clear();
    this.status.set('Desconectado');
  }
}
