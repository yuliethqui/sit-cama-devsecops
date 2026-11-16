import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForwardOutline, shieldCheckmarkOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { finalize } from 'rxjs';

import { ApiService, apiErrorMessage } from '../core/api.service';
import { SessionService } from '../core/session.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  imports: [ReactiveFormsModule, IonButton, IonIcon, IonSpinner],
})
export class LoginPage {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly expired = inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'expired';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  constructor() {
    addIcons({ arrowForwardOutline, shieldCheckmarkOutline, eyeOutline, eyeOffOutline });
  }
  submit(): void {
    if (this.loading()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.api
      .login(email.trim(), password)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (response) => {
          this.form.controls.password.reset();
          try {
            this.session.accept(response);
            void this.router.navigate(['/app/home'], { replaceUrl: true });
          } catch {
            this.error.set('No fue posible validar la sesión recibida. Inténtalo de nuevo.');
          }
        },
        error: (error: unknown) => {
          this.form.controls.password.reset();
          this.error.set(apiErrorMessage(error, 'login'));
        },
      });
  }
}
