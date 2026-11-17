import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { finalize } from 'rxjs';

import { ApiService, apiErrorMessage } from '../core/api.service';
import type { PanelResponse } from '../core/panel-contracts';
import { RealtimeService } from '../core/realtime.service';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'app-panel',
  templateUrl: './panel.page.html',
  imports: [PageHeaderComponent, DatePipe, IonButton, IonSpinner],
})
export class PanelPage {
  private readonly api = inject(ApiService);
  private readonly destroy = inject(DestroyRef);
  readonly realtime = inject(RealtimeService);
  readonly data = signal<PanelResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly page = signal(1);
  readonly audioEnabled = signal(false);
  private audio?: AudioContext;
  private queued = false;
  constructor() {
    this.realtime.connected$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.realtime.changed$.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.notice.set(
        event.criticalDemo
          ? 'Nuevo triaje I de demostración. Panel actualizado.'
          : 'Nuevo triaje registrado. Panel actualizado.',
      );
      if (event.criticalDemo) this.sound();
      this.page.set(1);
      this.load();
    });
    const visibility = () => {
      if (document.visibilityState === 'visible') {
        void this.realtime.start();
        this.load();
      } else this.realtime.stop();
    };
    document.addEventListener('visibilitychange', visibility);
    const offline = () => this.realtime.stop();
    const online = () => {
      void this.realtime.start();
      this.load();
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', (event) => {
        if (event.isActive) {
          void this.realtime.start();
          this.load();
        } else this.realtime.stop();
      }).then((handle) => {
        if (this.destroy.destroyed) void handle.remove();
        else
          this.destroy.onDestroy(() => {
            void handle.remove();
          });
      });
    }
    this.destroy.onDestroy(() => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      this.realtime.stop();
      void this.audio?.close();
    });
    this.load();
    void this.realtime.start();
  }
  async enableAudio(): Promise<void> {
    try {
      this.audio ??= new AudioContext();
      await this.audio.resume();
      this.audioEnabled.set(true);
    } catch {
      this.notice.set('El dispositivo no permite sonido. Los avisos visuales siguen disponibles.');
    }
  }
  private sound(): void {
    if (!this.audioEnabled() || this.audio?.state !== 'running') return;
    const tone = this.audio.createOscillator();
    const gain = this.audio.createGain();
    gain.gain.value = 0.06;
    tone.frequency.value = 660;
    tone.connect(gain);
    gain.connect(this.audio.destination);
    tone.start();
    tone.stop(this.audio.currentTime + 3);
    tone.onended = () => {
      tone.disconnect();
      gain.disconnect();
    };
  }
  changePage(delta: number): void {
    this.page.update((page) => page + delta);
    this.load();
  }
  load(): void {
    if (this.loading()) {
      this.queued = true;
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api
      .panel(this.page())
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => {
          this.loading.set(false);
          if (this.queued && !this.destroy.destroyed) {
            this.queued = false;
            this.load();
          }
        }),
      )
      .subscribe({
        next: (data) => this.data.set(data),
        error: (error: unknown) => {
          this.data.set(null);
          this.error.set(apiErrorMessage(error, 'panel'));
        },
      });
  }
}
