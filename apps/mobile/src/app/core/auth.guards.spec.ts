import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { provideRouter, UrlTree } from '@angular/router';

import { roleGuard, sessionGuard } from './auth.guards';
import { ROLES } from './contracts';
import { SessionService } from './session.service';

describe('Permisos de rutas para los seis roles', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  afterEach(() => TestBed.inject(SessionService).clear());
  it('redirige una navegación sin sesión al login', () => {
    const result = TestBed.runInInjectionContext(() =>
      sessionGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login');
  });
  it.each(ROLES)('respeta registro y búsqueda para %s', (role) => {
    TestBed.inject(SessionService).accept({
      role,
      access_token: `test.${btoa(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 900 }))}.test`,
    });
    for (const roles of [['ENFERMERO', 'MEDICO'], ['ENFERMERO', 'MEDICO', 'ADMISIONES'], ['MEDICO'], ['AUDITOR']]) {
      const result = TestBed.runInInjectionContext(() =>
        roleGuard({ data: { roles } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
      expect(result === true).toBe(roles.includes(role));
    }
  });
});
