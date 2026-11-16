import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, takeUntil, throwError, timeout } from 'rxjs';

import { API_BASE_URL } from './api-config';
import { SessionService } from './session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_BASE_URL);
  if (!base || !request.url.startsWith(`${base}/`)) return next(request);
  const session = inject(SessionService);
  const login = request.url === `${base}/auth/login`;
  const token = !login && session.isValid() ? session.token() : null;
  const authorized = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  let response = next(authorized).pipe(
    timeout(15000),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token && session.token() === token)
        session.logout('expired');
      return throwError(() => error);
    }),
  );
  if (token) response = response.pipe(takeUntil(session.ended$));
  return response;
};
