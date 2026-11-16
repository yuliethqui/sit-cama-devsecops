import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

import type { TriageSummary } from '../core/contracts';

@Component({
  selector: 'app-triage-summary',
  imports: [DatePipe],
  template: `
    <section
      class="triage-result"
      [class.priority-one]="summary()?.level === 'I'"
      [class.priority-two]="summary()?.level === 'II'"
      aria-label="Resultado de triaje demostrativo"
    >
      <div class="section-line">
        <span class="eyebrow">TRIAJE · DEMOSTRACIÓN</span
        ><span class="pill warning">Requiere valoración profesional</span>
      </div>
      @if (summary(); as triage) {
        @if (triage.level === 'I' || triage.level === 'II') {
          <span class="triage-symbol" aria-hidden="true">{{ triage.level }}</span>
          <h3 class="triage-level">Nivel {{ triage.level }} <span>propuesto por la API</span></h3>
          <p>
            Espera de referencia: <strong>{{ triage.maxWaitMinutes }} min</strong>
          </p>
        } @else {
          <h3>Pendiente de revisión clínica</h3>
          <p>No hay una clasificación demostrativa I/II disponible. No se asignan niveles III–V.</p>
        }
        <dl class="detail-list">
          <div>
            <dt>Registrado</dt>
            <dd>{{ triage.createdAt | date: 'dd/MM/yyyy, HH:mm' }}</dd>
          </div>
          <div>
            <dt>Minutos desde el registro</dt>
            <dd>{{ triage.elapsedMinutes }}</dd>
          </div>
        </dl>
      } @else {
        <h3>Triaje pendiente</h3>
        <p>Este registro todavía no tiene un resumen de triaje.</p>
      }
      <p class="fine-print">
        Resultado académico. No sustituye una valoración clínica, no representa la espera real ni garantiza un tiempo de
        atención.
      </p>
    </section>
  `,
})
export class TriageSummaryComponent {
  readonly summary = input<TriageSummary | null>(null);
}
