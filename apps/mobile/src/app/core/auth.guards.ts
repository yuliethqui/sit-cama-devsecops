import { inject } from '@angular/core';
import type { CanActivateChildFn, CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import type { Role } from './contracts';
import { SessionService } from './session.service';

export const sessionGuard: CanActivateFn = () =>
  inject(SessionService).isValid() || inject(Router).createUrlTree(['/login']);
export const guestGuard: CanActivateFn = () =>
  !inject(SessionService).isValid() || inject(Router).createUrlTree(['/app/home']);
export const roleGuard: CanActivateChildFn = (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.isValid()) return router.createUrlTree(['/login']);
  const roles = route.data['roles'] as readonly Role[] | undefined;
  return !roles || session.hasRole(roles) || router.createUrlTree(['/app/home']);
};
