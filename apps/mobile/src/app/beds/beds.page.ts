import { DatePipe } from '@angular/common';
import type { ElementRef } from '@angular/core';
import { Component, computed, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, bedOutline } from 'ionicons/icons';
import { finalize, Subject, takeUntil } from 'rxjs';
import type { Observable } from 'rxjs';

import { ApiService, apiErrorMessage } from '../core/api.service';
import type { Bed, BedAssignment, BedStatus, PatientSearchResponse } from '../core/contracts';
import { BED_STATES, serviceName, statusName } from '../core/contracts';
import { SessionService } from '../core/session.service';
import { documentValidator } from '../core/validators';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'app-beds',
  templateUrl: './beds.page.html',
  imports: [PageHeaderComponent, DatePipe, ReactiveFormsModule, IonButton, IonIcon, IonSpinner],
})
export class BedsPage {
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly session = inject(SessionService);
  @ViewChild('bedDialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  private readonly actionEnded = new Subject<void>();
  readonly action = signal<{ kind: 'assign' | 'release' | 'cleaning'; bed: Bed } | null>(null);
  readonly actionBusy = signal(false);
  readonly actionError = signal('');
  readonly actionStale = signal(false);
  readonly success = signal('');
  readonly selectedPatient = signal<PatientSearchResponse | null>(null);
  readonly reviewedAssignment = signal<BedAssignment | null>(null);
  readonly assignmentForm = inject(FormBuilder).nonNullable.group({
    document: ['', documentValidator],
    service: ['', Validators.required],
  });
  readonly canAssign = computed(() => this.session.role() === 'MEDICO');
  readonly canClean = computed(() => this.session.role() === 'SERVICIOS');
  readonly patientEligible = computed(() => {
    const triage = this.selectedPatient()?.latestTriage;
    return !!triage && (triage.level === 'I' || triage.level === 'II') && !triage.requiresClinicalReview;
  });
  readonly beds = signal<Bed[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly loadedAt = signal<Date | null>(null);
  readonly selectedService = signal('');
  readonly selectedStatus = signal('');
  readonly states = BED_STATES;
  readonly serviceName = serviceName;
  readonly statusName = statusName;
  readonly services = computed(() => [...new Set(this.beds().map((b) => b.service))].sort());
  readonly visible = computed(() =>
    this.beds().filter(
      (b) =>
        (!this.selectedService() || b.service === this.selectedService()) &&
        (!this.selectedStatus() || b.status === this.selectedStatus()),
    ),
  );
  readonly groups = computed(() =>
    [...new Set(this.visible().map((b) => b.service))].map((service) => ({
      service,
      beds: this.visible().filter((b) => b.service === service),
    })),
  );
  count(status: BedStatus): number {
    return this.beds().filter((b) => b.status === status).length;
  }
  stateClass(status: BedStatus): string {
    return this.states.find((state) => state.value === status)?.className ?? 'blocked';
  }
  constructor() {
    addIcons({ refreshOutline, bedOutline });
    this.load();
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.beds.set([]);
    this.loadedAt.set(null);
    this.api
      .beds()
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (beds) => {
          this.beds.set(beds);
          this.loadedAt.set(new Date());
        },
        error: (error: unknown) => this.error.set(apiErrorMessage(error, 'beds')),
      });
  }
  filterService(event: Event): void {
    this.selectedService.set((event.target as HTMLSelectElement).value);
  }
  filterStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
  }
  resetFilters(): void {
    this.selectedService.set('');
    this.selectedStatus.set('');
  }
  openAction(kind: 'assign' | 'release' | 'cleaning', bed: Bed): void {
    if (this.actionBusy() || (kind === 'cleaning' ? !this.canClean() : !this.canAssign())) return;
    this.actionEnded.next();
    this.selectedPatient.set(null);
    this.reviewedAssignment.set(null);
    this.actionError.set('');
    this.actionStale.set(false);
    this.success.set('');
    this.assignmentForm.reset({ document: '', service: bed.service });
    this.action.set({ kind, bed: { ...bed } });
    this.dialog.nativeElement.showModal();
    if (kind === 'release') {
      this.actionBusy.set(true);
      this.api
        .bedAssignment(bed.code)
        .pipe(
          takeUntil(this.actionEnded),
          takeUntilDestroyed(this.destroy),
          finalize(() => this.actionBusy.set(false)),
        )
        .subscribe({
          next: (detail) => {
            if (detail.bed.status !== 'OCCUPIED' || !detail.assignment) {
              this.actionError.set('La cama ya no tiene una ocupación que pueda liberarse. Actualiza el censo.');
              this.actionStale.set(true);
              return;
            }
            this.reviewedAssignment.set(detail.assignment);
          },
          error: (error: unknown) => {
            this.actionError.set(apiErrorMessage(error, 'release'));
            this.actionStale.set(true);
          },
        });
    }
  }
  closeAction(event?: Event): void {
    if (this.actionBusy()) {
      event?.preventDefault();
      return;
    }
    this.actionEnded.next();
    this.dialog.nativeElement.close();
    this.action.set(null);
    this.selectedPatient.set(null);
    this.reviewedAssignment.set(null);
    this.assignmentForm.reset();
  }
  clearPatient(): void {
    this.selectedPatient.set(null);
    this.actionError.set('');
  }
  clearLocalError(): void {
    if (!this.actionStale()) this.actionError.set('');
  }
  searchPatient(): void {
    if (this.actionBusy() || this.action()?.kind !== 'assign') return;
    this.assignmentForm.markAllAsTouched();
    this.actionError.set('');
    this.selectedPatient.set(null);
    if (this.assignmentForm.invalid) return;
    this.actionBusy.set(true);
    this.api
      .search(this.assignmentForm.controls.document.value.trim())
      .pipe(
        takeUntil(this.actionEnded),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.actionBusy.set(false)),
      )
      .subscribe({
        next: (patient) => {
          this.assignmentForm.controls.document.reset('', { emitEvent: false });
          this.selectedPatient.set(patient);
        },
        error: (error: unknown) => this.actionError.set(apiErrorMessage(error, 'search')),
      });
  }
  confirmAction(): void {
    const action = this.action();
    if (!action || this.actionBusy() || this.actionStale()) return;
    const patient = this.selectedPatient();
    const assignment = this.reviewedAssignment();
    let operation: Observable<unknown>;
    if (action.kind === 'assign') {
      if (!this.canAssign() || !patient || !this.patientEligible()) return;
      const service = this.assignmentForm.controls.service.value;
      if (service !== action.bed.service) {
        this.actionError.set('El servicio solicitado no coincide con el de esta cama.');
        return;
      }
      operation = this.api.assignBed(action.bed.code, patient.patientId, service);
    } else if (action.kind === 'release') {
      if (!this.canAssign() || !assignment) return;
      operation = this.api.releaseBed(action.bed.code, assignment.id);
    } else {
      if (!this.canClean()) return;
      operation = this.api.completeCleaning(action.bed.code, action.bed.updated_at);
    }
    this.actionBusy.set(true);
    this.actionError.set('');
    operation
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.actionBusy.set(false)),
      )
      .subscribe({
        next: () => {
          this.actionBusy.set(false);
          this.closeAction();
          this.success.set(
            action.kind === 'assign'
              ? `Asignación confirmada: ${action.bed.code} está ocupada.`
              : action.kind === 'release'
                ? `Liberación confirmada: ${action.bed.code} está en limpieza.`
                : `Limpieza confirmada: ${action.bed.code} está disponible.`,
          );
          this.load();
        },
        error: (error: unknown) => {
          this.actionError.set(apiErrorMessage(error, action.kind));
          this.actionStale.set(true);
          this.load();
        },
      });
  }
  cleaningMinutes(bed: Bed): number {
    return Math.max(0, Math.floor((Date.now() - Date.parse(bed.updated_at)) / 60000));
  }
}
