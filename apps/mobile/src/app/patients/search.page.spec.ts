import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { ApiService } from '../core/api.service';
import type { PatientSearchResponse } from '../core/contracts';

import { SearchPage } from './search.page';

describe('Búsqueda exacta: resultado y borrado del documento', () => {
  it.each([404, 403])('presenta error %s y evita enviar búsquedas inválidas o concurrentes', (status) => {
    const pending = new Subject<never>();
    const search = vi.fn(() => pending);
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { search } }] });
    const fixture = TestBed.createComponent(SearchPage);
    const page = fixture.componentInstance;
    page.submit();
    expect(search).not.toHaveBeenCalled();
    page.form.controls.document.setValue('DEMO-001');
    page.submit();
    page.submit();
    expect(search).toHaveBeenCalledOnce();
    pending.error(new HttpErrorResponse({ status }));
    fixture.detectChanges();
    expect(page.notFound()).toBe(status === 404);
    expect(page.error().length > 0).toBe(status === 403);
    page.clear();
    expect(page.form.controls.document.value).toBe('');
    expect(page.notFound()).toBe(false);
  });
  it('conserva la respuesta al limpiar el documento y la borra al editar una nueva consulta', () => {
    const response = new Subject<PatientSearchResponse>();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { search: () => response } }] });
    const fixture = TestBed.createComponent(SearchPage);
    const page = fixture.componentInstance;
    page.form.controls.document.setValue('DEMO-001');
    page.submit();
    expect(page.loading()).toBe(true);
    response.next({
      patientId: crypto.randomUUID(),
      provisional: false,
      createdAt: new Date().toISOString(),
      triageStatus: 'PENDING_TRIAGE',
      latestTriage: null,
    });
    response.complete();
    fixture.detectChanges();
    expect(page.form.controls.document.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Registro encontrado');
    expect(page.result()).not.toBeNull();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'DEMO-002';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(page.result()).toBeNull();
  });
});
