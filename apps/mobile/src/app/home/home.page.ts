import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { finalize } from 'rxjs';

import { ApiService, apiErrorMessage } from '../core/api.service';
import type { Bed } from '../core/contracts';
import { REGISTER_ROLES, ROLE_NAMES, SEARCH_ROLES } from '../core/contracts';
import { SessionService } from '../core/session.service';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  imports: [PageHeaderComponent, RouterLink, IonButton, IonIcon, IonSpinner],
})
export class HomePage {
  readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly beds = signal<Bed[]>([]);
  readonly available = computed(() => this.beds().filter((b) => b.status === 'AVAILABLE').length);
  readonly services = computed(() => new Set(this.beds().map((b) => b.service)).size);
  readonly roleName = computed(() => ROLE_NAMES[this.session.role()!]);
  readonly canRegister = computed(() => this.session.hasRole(REGISTER_ROLES));
  readonly canSearch = computed(() => this.session.hasRole(SEARCH_ROLES));
  constructor() {
    this.load();
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.beds.set([]);
    this.api
      .beds()
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (beds) => this.beds.set(beds),
        error: (error: unknown) => this.error.set(apiErrorMessage(error, 'beds')),
      });
  }
}
