import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { finalize } from 'rxjs';

import { ApiService, apiErrorMessage } from '../core/api.service';
import type { RegistrationResponse } from '../core/contracts';
import { documentValidator, integer, noControlCharacters, trimmedLength } from '../core/validators';
import { PageHeaderComponent } from '../shared/page-header.component';
import { TriageSummaryComponent } from '../shared/triage-summary.component';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  imports: [PageHeaderComponent, ReactiveFormsModule, IonButton, IonIcon, IonSpinner, TriageSummaryComponent],
})
export class RegisterPage {
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly result = signal<RegistrationResponse | null>(null);
  readonly form = inject(FormBuilder).group({
    document: ['', [documentValidator]],
    fullName: ['', [trimmedLength(2, 160), noControlCharacters]],
    chiefComplaint: ['', [trimmedLength(1, 1000)]],
    spo2: new FormControl<number | null>(null, [Validators.required, integer, Validators.min(0), Validators.max(100)]),
    glasgow: new FormControl<number | null>(null, [
      Validators.required,
      integer,
      Validators.min(3),
      Validators.max(15),
    ]),
    eva: new FormControl<number | null>(null, [Validators.required, integer, Validators.min(0), Validators.max(10)]),
    paroInminente: new FormControl(false, { nonNullable: true }),
    dolorToracicoTipico: new FormControl(false, { nonNullable: true }),
  });
  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }
  submit(): void {
    if (this.loading()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    this.result.set(null);
    if (this.form.invalid) {
      this.error.set('Revisa los campos señalados antes de registrar.');
      return;
    }
    const value = this.form.getRawValue();
    this.loading.set(true);
    this.api
      .register({
        document: value.document!.trim(),
        fullName: value.fullName!.trim(),
        triage: {
          chiefComplaint: value.chiefComplaint!.trim(),
          spo2: value.spo2!,
          glasgow: value.glasgow!,
          eva: value.eva!,
          paroInminente: value.paroInminente,
          dolorToracicoTipico: value.dolorToracicoTipico,
        },
      })
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.form.reset();
        },
        error: (error: unknown) => this.error.set(apiErrorMessage(error, 'register')),
      });
  }
  newRegistration(): void {
    this.result.set(null);
    this.error.set('');
    this.form.reset();
  }
}
