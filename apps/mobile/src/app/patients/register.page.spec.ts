import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { ApiService } from '../core/api.service';

import { RegisterPage } from './register.page';

describe('Registro validado y limpieza de datos', () => {
  const register = vi.fn();
  beforeEach(() => {
    register.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { register } }] });
  });
  it('no envía formulario incompleto ni valores fraccionarios/fuera de rango', () => {
    const page = TestBed.createComponent(RegisterPage).componentInstance;
    page.submit();
    expect(register).not.toHaveBeenCalled();
    page.form.patchValue({
      document: 'DEMO-1',
      fullName: 'Persona Sintética',
      chiefComplaint: 'Prueba',
      spo2: 84.5,
      glasgow: 15,
      eva: 2,
    });
    page.submit();
    expect(register).not.toHaveBeenCalled();
    page.form.controls.spo2.setValue(101);
    page.submit();
    expect(register).not.toHaveBeenCalled();
  });
  it('envía el DTO real sin nivel y elimina identidad/signos al confirmar', () => {
    register.mockReturnValue(
      of({
        patientId: crypto.randomUUID(),
        provisional: false,
        createdAt: new Date().toISOString(),
        triage: { level: null, demoOnly: true },
      }),
    );
    const page = TestBed.createComponent(RegisterPage).componentInstance;
    page.form.patchValue({
      document: ' DEMO-1 ',
      fullName: ' Persona Sintética ',
      chiefComplaint: ' Prueba sintética ',
      spo2: 98,
      glasgow: 15,
      eva: 1,
    });
    page.submit();
    expect(register).toHaveBeenCalledWith({
      document: 'DEMO-1',
      fullName: 'Persona Sintética',
      triage: {
        chiefComplaint: 'Prueba sintética',
        spo2: 98,
        glasgow: 15,
        eva: 1,
        paroInminente: false,
        dolorToracicoTipico: false,
      },
    });
    expect(page.form.controls.fullName.value).toBeNull();
    expect(page.form.controls.spo2.value).toBeNull();
    expect(page.result()?.triage.level).toBeNull();
  });
  it('muestra conflicto, bloquea doble envío y permite limpiar el formulario', () => {
    const pending = new Subject<never>();
    register.mockReturnValue(pending);
    const fixture = TestBed.createComponent(RegisterPage);
    const page = fixture.componentInstance;
    page.form.patchValue({
      document: 'DEMO-2',
      fullName: 'Persona Sintética',
      chiefComplaint: 'Prueba',
      spo2: 98,
      glasgow: 15,
      eva: 1,
    });
    page.submit();
    page.submit();
    expect(register).toHaveBeenCalledOnce();
    pending.error(new HttpErrorResponse({ status: 409 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ya está registrado');
    page.newRegistration();
    page.submit();
    fixture.detectChanges();
    expect(page.invalid('document')).toBe(true);
    expect(page.result()).toBeNull();
    register.mockReturnValue(throwError(() => new Error('unused')));
  });
});
