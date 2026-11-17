import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import type { LoginResponse, Role } from './contracts';
import { ROLES } from './contracts';

interface Session {
  token: string;
  role: Role;
  expiresAt: number;
}
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly router = inject(Router);
  private readonly current = signal<Session | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  private readonly ended = new Subject<void>();
  readonly ended$ = this.ended.asObservable();
  readonly role = computed(() => this.current()?.role ?? null);
  readonly active = computed(() => this.current() !== null);
  readonly token = computed(() => this.current()?.token ?? null);
  // Decoding drives UI/expiry only. The API verifies signatures and permissions.
  accept(response: LoginResponse): void {
    let payload: { exp: number; role: Role };
    try {
      const encoded = response.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      payload = JSON.parse(atob(encoded));
      if (
        !ROLES.includes(response.role) ||
        payload.role !== response.role ||
        !Number.isFinite(payload.exp) ||
        payload.exp * 1000 <= Date.now()
      )
        throw new Error();
    } catch {
      throw new Error('No fue posible validar la sesión recibida.');
    }
    this.clear();
    this.current.set({ token: response.access_token, role: response.role, expiresAt: payload.exp * 1000 });
    this.timer = setTimeout(() => this.logout('expired'), Math.min(payload.exp * 1000 - Date.now(), 2147483647));
  }
  hasRole(roles: readonly Role[]): boolean {
    return !!this.role() && roles.includes(this.role()!);
  }
  isValid(): boolean {
    const session = this.current();
    if (session && session.expiresAt <= Date.now()) {
      this.logout('expired');
      return false;
    }
    return session !== null;
  }
  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.current.set(null);
    this.ended.next();
  }
  logout(reason?: 'expired'): void {
    this.clear();
    void this.router.navigate(['/login'], { replaceUrl: true, queryParams: reason ? { reason } : {} });
  }
}
