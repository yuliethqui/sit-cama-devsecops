import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { API_BASE_URL } from './api-config';
import { NativeRuntimeService } from './native-runtime.service';
import { RealtimeService } from './realtime.service';
import { SessionService } from './session.service';

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (event?: unknown) => void>();
  const socket = {
    on: vi.fn((event: string, fn: (event?: unknown) => void) => listeners.set(event, fn)),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  };
  return { listeners, socket, io: vi.fn(() => socket) };
});
vi.mock('socket.io-client', () => ({ io: mocks.io }));

describe('Socket.IO: ciclo de sesión y datos mínimos', () => {
  let role: string;
  let ended: Subject<void>;
  beforeEach(() => {
    role = 'MEDICO';
    ended = new Subject();
    mocks.listeners.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        { provide: NativeRuntimeService, useValue: { debuggable: false } },
        {
          provide: SessionService,
          useValue: { role: () => role, token: () => 'memory-token', isValid: () => true, ended$: ended },
        },
      ],
    });
  });
  it('envía JWT en auth, sincroniza al conectar y desconecta al cerrar sesión', async () => {
    const service = TestBed.inject(RealtimeService);
    const refreshed = vi.fn();
    service.connected$.subscribe(refreshed);
    await service.start();
    expect(mocks.io).toHaveBeenCalledWith(
      'http://localhost:3000/triage',
      expect.objectContaining({ auth: { token: 'memory-token' }, transports: ['websocket'] }),
    );
    mocks.listeners.get('connect')!();
    expect(mocks.socket.emit).toHaveBeenCalledWith('triage:sync', {});
    expect(service.status()).toBe('En vivo');
    expect(refreshed).toHaveBeenCalledOnce();
    ended.next();
    expect(mocks.socket.disconnect).toHaveBeenCalled();
    expect(service.status()).toBe('Desconectado');
  });
  it('deduplica y valida avisos; no propaga propiedades ajenas', async () => {
    const service = TestBed.inject(RealtimeService);
    const receive = vi.fn();
    service.changed$.subscribe(receive);
    await service.start();
    const notice = { eventId: crypto.randomUUID(), criticalDemo: true, secret: 'discarded' };
    mocks.listeners.get('triage:changed')!(notice);
    mocks.listeners.get('triage:changed')!(notice);
    mocks.listeners.get('triage:changed')!({ eventId: 'invalid', criticalDemo: true });
    expect(receive).toHaveBeenCalledOnce();
    expect(receive).toHaveBeenCalledWith({ eventId: notice.eventId, criticalDemo: true });
    mocks.listeners.get('connect_error')!();
    expect(service.status()).toBe('Sin conexión en vivo');
    service.stop();
  });
  it('SERVICIOS no inicia conexiones clínicas', async () => {
    role = 'SERVICIOS';
    await TestBed.inject(RealtimeService).start();
    expect(mocks.io).not.toHaveBeenCalled();
  });
});
