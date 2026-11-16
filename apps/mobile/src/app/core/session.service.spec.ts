import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import type { LoginResponse, Role } from './contracts';
import { SessionService } from './session.service';

function response(role: Role, seconds = 10): LoginResponse {
  return {
    role,
    access_token: `test.${btoa(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + seconds }))}.test`,
  };
}
describe('Sesión exclusivamente en memoria', () => {
  let session: SessionService;
  const navigate = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigate } }] });
    session = TestBed.inject(SessionService);
    navigate.mockClear();
  });
  afterEach(() => {
    session.clear();
    vi.useRealTimers();
  });
  it('vence y cancela las operaciones de la sesión', () => {
    const ended = vi.fn();
    session.ended$.subscribe(ended);
    session.accept(response('MEDICO'));
    ended.mockClear();
    expect(session.hasRole(['MEDICO'])).toBe(true);
    vi.advanceTimersByTime(10000);
    expect(session.active()).toBe(false);
    expect(session.token()).toBeNull();
    expect(ended).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ replaceUrl: true }));
  });
  it('rechaza tokens vencidos, roles desconocidos y discrepancias', () => {
    expect(() => session.accept(response('MEDICO', -1))).toThrow();
    expect(() => session.accept({ ...response('MEDICO'), role: 'AUDITOR' })).toThrow();
    expect(() => session.accept({ access_token: 'inválido', role: 'ENFERMERO' })).toThrow();
    expect(session.active()).toBe(false);
  });
  it('no escribe en almacenamiento web y elimina el token al salir', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    session.accept(response('ADMISIONES'));
    session.logout();
    expect(local).not.toHaveBeenCalled();
    expect(session.token()).toBeNull();
    local.mockRestore();
  });
});
