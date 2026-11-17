import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';

import { LoginPage } from './login.page';

describe('Login: errores, doble envío y sesión exclusivamente en memoria', () => {
  const login = vi.fn();
  const accept = vi.fn();
  const navigate = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { login } },
        { provide: SessionService, useValue: { accept } },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ reason: 'expired' }) } },
        },
      ],
    });
  });
  function view() {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ email: 'sintetico@example.test', password: crypto.randomUUID() });
    return fixture;
  }
  it('no envía campos inválidos y muestra expiración', () => {
    const fixture = view();
    fixture.componentInstance.form.controls.email.setValue('invalid');
    fixture.componentInstance.submit();
    expect(login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.expired).toBe(true);
  });
  it('impide envíos concurrentes, borra contraseña y navega al aceptar JWT', () => {
    const pending = new Subject<unknown>();
    login.mockReturnValue(pending);
    const fixture = view();
    const page = fixture.componentInstance;
    page.submit();
    page.submit();
    expect(login).toHaveBeenCalledOnce();
    expect(page.loading()).toBe(true);
    pending.next({ role: 'MEDICO', access_token: 'test-in-memory' });
    pending.complete();
    expect(accept).toHaveBeenCalledOnce();
    expect(page.form.controls.password.value).toBe('');
    expect(page.loading()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/app/home'], { replaceUrl: true });
  });
  it('rechaza sesión inválida y credenciales incorrectas sin conservar contraseña', () => {
    login.mockReturnValue(of({}));
    accept.mockImplementationOnce(() => {
      throw new Error('invalid');
    });
    const fixture = view();
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.error()).toContain('validar');
    fixture.componentInstance.form.controls.password.setValue(crypto.randomUUID());
    login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('incorrectos');
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });
});
