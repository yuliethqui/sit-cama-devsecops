import { routes } from './app.routes';
import { guestGuard, roleGuard, sessionGuard } from './core/auth.guards';

describe('Rutas publicadas y protección de módulos', () => {
  it('conserva guards y roles restringidos en los módulos publicados', () => {
    const login = routes.find((r) => r.path === 'login')!;
    const app = routes.find((r) => r.path === 'app')!;
    expect(login.canActivate).toContain(guestGuard);
    expect(app.canActivate).toContain(sessionGuard);
    expect(app.canActivateChild).toContain(roleGuard);
    expect(app.children?.find((r) => r.path === 'audit')?.data?.['roles']).toEqual(['AUDITOR']);
    expect(app.children?.find((r) => r.path === 'panel')?.data?.['roles']).toEqual(['MEDICO']);
    expect(app.children?.filter((r) => r.loadComponent).map((r) => r.path)).toEqual([
      'panel',
      'audit',
      'home',
      'register',
      'search',
      'beds',
    ]);
  });
});
