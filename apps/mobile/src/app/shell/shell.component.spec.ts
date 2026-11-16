import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ROLES, type Role } from '../core/contracts';
import { SessionService } from '../core/session.service';

import { ShellComponent } from './shell.component';

describe('Navegación visible según rol', () => {
  it.each(ROLES)('limita los accesos de %s', (value) => {
    const role = signal<Role | null>(value);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: { role, hasRole: (allowed: Role[]) => allowed.includes(value), clear: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const paths = fixture.componentInstance.links().map((link) => link.path);
    expect(paths.includes('/app/panel')).toBe(value === 'MEDICO');
    expect(paths.includes('/app/audit')).toBe(value === 'AUDITOR');
    expect(paths.includes('/app/register')).toBe(['MEDICO', 'ENFERMERO'].includes(value));
    expect(paths).toContain('/app/beds');
    role.set(null);
    expect(fixture.componentInstance.roleName()).toBe('');
  });
});
