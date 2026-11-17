import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { ApiService } from '../core/api.service';
import type { Bed, BedAssigned, PatientSearchResponse, Role } from '../core/contracts';
import { SessionService } from '../core/session.service';

import { BedsPage } from './beds.page';

const free: Bed = {
  code: 'UA-01',
  service: 'URGENCIAS_ADULTOS',
  status: 'AVAILABLE',
  updated_at: '2026-11-14T12:00:00.123456Z',
};
const patient: PatientSearchResponse = {
  patientId: '11111111-1111-4111-8111-111111111111',
  provisional: false,
  createdAt: free.updated_at,
  triageStatus: 'DEMO_CLASSIFIED',
  latestTriage: {
    id: 'triage',
    level: 'I',
    maxWaitMinutes: 0,
    requiresClinicalReview: false,
    createdAt: free.updated_at,
    elapsedMinutes: 0,
    demoOnly: true,
  },
};
describe('Acciones de camas: permisos, confirmación y conflictos', () => {
  let role: Role;
  const api = {
    beds: vi.fn(),
    search: vi.fn(),
    assignBed: vi.fn(),
    bedAssignment: vi.fn(),
    releaseBed: vi.fn(),
    completeCleaning: vi.fn(),
  };
  beforeEach(() => {
    role = 'MEDICO';
    for (const fn of Object.values(api)) fn.mockReset();
    api.beds.mockReturnValue(of([free]));
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: SessionService, useValue: { role: () => role } },
      ],
    });
  });
  function fixture() {
    const fixture = TestBed.createComponent(BedsPage);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    return fixture;
  }
  it.each(['ENFERMERO', 'ADMISIONES', 'COORDINADOR', 'AUDITOR'] as Role[])(
    'no habilita operaciones para %s',
    (value) => {
      role = value;
      const fixture = TestBed.createComponent(BedsPage);
      const page = fixture.componentInstance;
      expect(page.canAssign()).toBe(false);
      expect(page.canClean()).toBe(false);
      page.openAction('assign', free);
      expect(page.action()).toBeNull();
      expect(api.assignBed).not.toHaveBeenCalled();
    },
  );
  it('busca por documento y solo envía la asignación tras confirmación explícita', () => {
    const pending = new Subject<BedAssigned>();
    api.search.mockReturnValue(of(patient));
    api.assignBed.mockReturnValue(pending);
    const view = fixture();
    const page = view.componentInstance;
    page.openAction('assign', free);
    page.assignmentForm.controls.document.setValue('DEMO-001');
    page.searchPatient();
    expect(api.assignBed).not.toHaveBeenCalled();
    expect(page.assignmentForm.controls.document.value).toBe('');
    page.confirmAction();
    page.confirmAction();
    expect(api.assignBed).toHaveBeenCalledOnce();
    expect(api.assignBed).toHaveBeenCalledWith(free.code, patient.patientId, free.service);
    pending.next({
      bed: { ...free, status: 'OCCUPIED' },
      assignment: { id: 'assignment', patientId: patient.patientId, assignedAt: free.updated_at },
      demoOnly: true,
    });
    pending.complete();
    expect(page.action()).toBeNull();
    expect(page.selectedPatient()).toBeNull();
    expect(page.success()).toContain('Asignación confirmada');
  });
  it('rechaza en la interfaz el caso pendiente y el servicio que no coincide', () => {
    const view = fixture();
    const page = view.componentInstance;
    page.openAction('assign', free);
    page.selectedPatient.set({ ...patient, latestTriage: null });
    page.confirmAction();
    expect(api.assignBed).not.toHaveBeenCalled();
    page.selectedPatient.set(patient);
    page.assignmentForm.controls.service.setValue('AISLAMIENTO');
    page.confirmAction();
    expect(api.assignBed).not.toHaveBeenCalled();
    expect(page.actionError()).toContain('no coincide');
  });
  it('conserva el UUID revisado para liberar y reenvía la versión íntegra para limpiar', () => {
    const view = fixture();
    const page = view.componentInstance;
    const assignment = { id: 'reviewed', patientId: patient.patientId, assignedAt: free.updated_at };
    api.bedAssignment.mockReturnValue(of({ bed: { ...free, status: 'OCCUPIED' }, assignment }));
    api.releaseBed.mockReturnValue(of({ bed: { ...free, status: 'CLEANING' }, assignmentId: assignment.id }));
    page.openAction('release', { ...free, status: 'OCCUPIED' });
    page.confirmAction();
    expect(api.releaseBed).toHaveBeenCalledWith(free.code, 'reviewed');
    role = 'SERVICIOS';
    // Role is normally a signal; a fresh component represents the new authenticated session.
    const cleanView = fixture();
    const cleanPage = cleanView.componentInstance;
    api.completeCleaning.mockReturnValue(of(free));
    cleanPage.openAction('cleaning', { ...free, status: 'CLEANING' });
    cleanPage.confirmAction();
    expect(api.completeCleaning).toHaveBeenCalledWith(free.code, free.updated_at);
  });
  it('un 409 obliga a revisar de nuevo y actualiza el censo sin reintentar la escritura', () => {
    const view = fixture();
    const page = view.componentInstance;
    page.openAction('assign', free);
    page.selectedPatient.set(patient);
    api.assignBed.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    page.confirmAction();
    page.confirmAction();
    expect(api.assignBed).toHaveBeenCalledOnce();
    expect(page.actionStale()).toBe(true);
    expect(page.actionError()).toContain('No se puede asignar');
    expect(api.beds).toHaveBeenCalledTimes(2);
  });
  it('no permite salir durante una escritura y limpia el paciente al cancelar una revisión', () => {
    const view = fixture();
    const page = view.componentInstance;
    page.openAction('assign', free);
    page.selectedPatient.set(patient);
    page.actionBusy.set(true);
    const event = new Event('cancel', { cancelable: true });
    page.closeAction(event);
    expect(event.defaultPrevented).toBe(true);
    expect(page.action()).not.toBeNull();
    page.actionBusy.set(false);
    page.closeAction();
    expect(page.selectedPatient()).toBeNull();
    expect(page.action()).toBeNull();
  });
});
