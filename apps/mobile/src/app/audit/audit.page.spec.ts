import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ApiService } from '../core/api.service';

import { AuditPage } from './audit.page';

describe('Auditoría: filtros y cursores', () => {
  const audit = vi.fn();
  beforeEach(() => {
    audit.mockReset().mockReturnValue(of({ items: [], nextCursor: '9007199254740993', limit: 25 }));
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { audit } }] });
  });
  it('preserva bigint como texto, avanza y vuelve con los filtros aplicados', () => {
    const page = TestBed.createComponent(AuditPage).componentInstance;
    page.form.patchValue({ action: 'RECORD_TRIAGE', from: '2026-11-14T08:00' });
    page.apply();
    page.form.patchValue({ action: 'SEARCH_PATIENT' });
    page.next();
    expect(audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'RECORD_TRIAGE', cursor: '9007199254740993' }),
    );
    page.previous();
    expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: '' }));
    page.clear();
    expect(page.history()).toEqual(['']);
    expect(page.form.controls.action.value).toBe('');
  });
  it('rechaza fechas invertidas/actor inválido sin pedir datos y muestra fallos', () => {
    const page = TestBed.createComponent(AuditPage).componentInstance;
    page.form.patchValue({ from: '2026-11-15T00:00', to: '2026-11-14T00:00' });
    page.apply();
    expect(audit).toHaveBeenCalledTimes(1);
    expect(page.error()).toContain('intervalo');
    page.form.patchValue({ from: '', to: '', actorId: 'invalid' });
    page.apply();
    expect(audit).toHaveBeenCalledTimes(1);
    audit.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    page.clear();
    expect(page.data()).toBeNull();
    expect(page.error()).toContain('servidor');
  });
});
