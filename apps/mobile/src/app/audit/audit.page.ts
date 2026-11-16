import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonSpinner } from '@ionic/angular';
import { finalize } from 'rxjs';

import { ApiService, apiErrorMessage } from '../core/api.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../core/panel-contracts';
import type { AuditResponse } from '../core/panel-contracts';
import { FilterDisclosureComponent } from '../shared/filter-disclosure.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'app-audit',
  templateUrl: './audit.page.html',
  imports: [FilterDisclosureComponent, PageHeaderComponent, DatePipe, ReactiveFormsModule, IonButton, IonSpinner],
})
export class AuditPage {
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly actions = AUDIT_ACTIONS;
  readonly entities = AUDIT_ENTITIES;
  readonly form = inject(FormBuilder).nonNullable.group({
    from: [''],
    to: [''],
    actorId: ['', Validators.pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i)],
    action: [''],
    entityType: [''],
  });
  readonly data = signal<AuditResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly history = signal<string[]>(['']);
  private applied: Record<string, string> = {};
  constructor() {
    this.apply();
  }
  apply(): void {
    if (this.loading()) return;
    this.error.set('');
    const value = this.form.getRawValue();
    const from = value.from ? new Date(value.from) : null;
    const to = value.to ? new Date(value.to) : null;
    if (
      this.form.invalid ||
      (from && !Number.isFinite(from.getTime())) ||
      (to && !Number.isFinite(to.getTime())) ||
      (from && to && from > to)
    ) {
      this.error.set('Revisa el UUID del actor y el intervalo de fechas.');
      return;
    }
    this.applied = { ...value, from: from?.toISOString() ?? '', to: to?.toISOString() ?? '' };
    this.history.set(['']);
    this.load();
  }
  clear(): void {
    this.form.reset();
    this.apply();
  }
  next(): void {
    const cursor = this.data()?.nextCursor;
    if (cursor) {
      this.history.update((h) => [...h, cursor]);
      this.load();
    }
  }
  previous(): void {
    this.history.update((h) => h.slice(0, -1));
    this.load();
  }
  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.data.set(null);
    this.api
      .audit({ ...this.applied, cursor: this.history().at(-1)!, limit: '25' })
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (data) => this.data.set(data),
        error: (error: unknown) => this.error.set(apiErrorMessage(error, 'audit')),
      });
  }
}
