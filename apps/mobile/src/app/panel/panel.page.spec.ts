import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';

import { PanelPage } from './panel.page';

describe('Panel médico: refresco y avisos', () => {
  const changed = new Subject<{ eventId: string; criticalDemo: boolean }>();
  const connected = new Subject<void>();
  const response = {
    items: [],
    totals: { total: 0, levelI: 0, levelII: 0, pending: 0 },
    page: 1,
    limit: 25,
    windowHours: 24,
  };
  const panel = vi.fn();
  const realtime = {
    changed$: changed,
    connected$: connected,
    status: signal('En vivo'),
    start: vi.fn(),
    stop: vi.fn(),
  };
  beforeEach(() => {
    panel.mockReset().mockReturnValue(of(response));
    realtime.start.mockReset();
    realtime.stop.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { panel } },
        { provide: RealtimeService, useValue: realtime },
      ],
    });
  });
  it('muestra vacío, consulta al reconectar y no acumula registros en cada aviso', () => {
    const fixture = TestBed.createComponent(PanelPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin triajes recientes');
    connected.next();
    expect(panel).toHaveBeenCalledTimes(2);
    changed.next({ eventId: crypto.randomUUID(), criticalDemo: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nuevo triaje I');
    expect(fixture.componentInstance.data()?.items).toEqual([]);
    fixture.destroy();
    expect(realtime.stop).toHaveBeenCalled();
  });
  it('agrupa refrescos concurrentes y elimina datos al fallar una consulta', () => {
    const pending = new Subject<typeof response>();
    panel.mockReturnValueOnce(pending);
    const fixture = TestBed.createComponent(PanelPage);
    connected.next();
    connected.next();
    expect(panel).toHaveBeenCalledTimes(1);
    pending.next(response);
    pending.complete();
    expect(panel).toHaveBeenCalledTimes(2);
    panel.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    fixture.componentInstance.load();
    expect(fixture.componentInstance.data()).toBeNull();
    expect(fixture.componentInstance.error()).toContain('permiso');
  });
  it('el sonido requiere activación y dura tres segundos', async () => {
    const stop = vi.fn();
    const oscillator = { connect: vi.fn(), start: vi.fn(), stop, frequency: { value: 0 }, disconnect: vi.fn() };
    const audio = {
      state: 'running',
      currentTime: 10,
      resume: vi.fn(),
      close: vi.fn(),
      destination: {},
      createOscillator: () => oscillator,
      createGain: () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
    };
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          return audio;
        }
      },
    );
    const fixture = TestBed.createComponent(PanelPage);
    changed.next({ eventId: crypto.randomUUID(), criticalDemo: true });
    expect(stop).not.toHaveBeenCalled();
    await fixture.componentInstance.enableAudio();
    changed.next({ eventId: crypto.randomUUID(), criticalDemo: true });
    expect(stop).toHaveBeenCalledWith(13);
    fixture.destroy();
    expect(audio.close).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
