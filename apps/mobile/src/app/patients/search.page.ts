import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { finalize } from 'rxjs';

import { ApiService, apiErrorMessage } from '../core/api.service';
import type { PatientSearchResponse } from '../core/contracts';
import { documentValidator } from '../core/validators';
import { PageHeaderComponent } from '../shared/page-header.component';
import { TriageSummaryComponent } from '../shared/triage-summary.component';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  imports: [PageHeaderComponent, ReactiveFormsModule, DatePipe, IonIcon, IonSpinner, TriageSummaryComponent],
})
export class SearchPage {
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group({ document: ['', documentValidator] });
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notFound = signal(false);
  readonly result = signal<PatientSearchResponse | null>(null);
  clearResult(): void {
    this.result.set(null);
    this.notFound.set(false);
    this.error.set('');
  }
  submit(): void {
    if (this.loading()) return;
    this.form.markAllAsTouched();
    this.result.set(null);
    this.notFound.set(false);
    this.error.set('');
    if (this.form.invalid) return;
    this.loading.set(true);
    this.api
      .search(this.form.controls.document.value.trim())
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.form.reset(undefined, { emitEvent: false });
          this.result.set(result);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) this.notFound.set(true);
          else this.error.set(apiErrorMessage(error, 'search'));
        },
      });
  }
  clear(): void {
    this.form.reset();
    this.result.set(null);
    this.notFound.set(false);
    this.error.set('');
  }
}
