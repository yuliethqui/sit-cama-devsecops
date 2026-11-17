import { TestBed } from '@angular/core/testing';

import { ApiService } from '../core/api.service';

import { RegisterPage } from './register.page';

describe('Incremento 08: validación del formulario antes del HTTP', () => {
  const register = vi.fn();
  beforeEach(() => {
    register.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { register } }] });
  });
  function view() {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.componentInstance.form.setValue({
      document: 'DEMO-INC08',
      fullName: 'Persona Sintética',
      chiefComplaint: 'Caso sintético',
      spo2: 98,
      glasgow: 15,
      eva: 1,
      paroInminente: false,
      dolorToracicoTipico: false,
    });
    return fixture;
  }
  it.each([
    ['document', null],
    ['fullName', null],
    ['chiefComplaint', null],
    ['spo2', null],
    ['glasgow', null],
    ['eva', null],
    ['document', '\u00a0\t '],
    ['fullName', '\u00a0 '],
    ['chiefComplaint', '\n\t '],
    ['document', "' OR 1=1 --"],
    ['document', 'A'.repeat(41)],
    ['fullName', 'A'.repeat(161)],
    ['fullName', 'Demo\u0000Persona'],
    ['fullName', 'Demo\u007fPersona'],
    ['chiefComplaint', 'A'.repeat(1001)],
    ['glasgow', 2],
    ['glasgow', 16],
    ['glasgow', 8.5],
    ['eva', -1],
    ['eva', 11],
    ['eva', 7.5],
    ['spo2', Number.NaN],
    ['spo2', Infinity],
    ['glasgow', '15'],
    ['eva', true],
    ['spo2', {}],
  ])('bloquea %s inválido (%j), marca el campo y no llama a la API', (field, value) => {
    const fixture = view();
    const page = fixture.componentInstance;
    const control = page.form.get(field as string)!;
    control.setValue(value);
    page.submit();
    fixture.detectChanges();
    expect(control.invalid).toBe(true);
    expect(control.touched).toBe(true);
    expect(register).not.toHaveBeenCalled();
    expect(page.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Revisa los campos');
  });
  it.each([
    { document: 'A-1', fullName: 'Á🩺', chiefComplaint: 'Ñ', spo2: 0, glasgow: 3, eva: 0 },
    {
      document: 'A'.repeat(40),
      fullName: 'Ñ'.repeat(160),
      chiefComplaint: 'ó'.repeat(1000),
      spo2: 100,
      glasgow: 15,
      eva: 10,
    },
    {
      document: 'DEMO.08-001',
      fullName: "Muñoz-O'Neil & <demo>",
      chiefComplaint: 'Caso ficticio: "comillas", ñ y <texto>.',
      spo2: 98,
      glasgow: 14,
      eva: 7,
    },
  ])('admite extremos y texto Unicode permitido sin convertirlos en errores clínicos', (value) => {
    const page = view().componentInstance;
    page.form.patchValue(value);
    expect(page.form.valid).toBe(true);
    expect(register).not.toHaveBeenCalled();
  });
});
