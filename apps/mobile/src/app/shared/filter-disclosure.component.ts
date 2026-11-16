import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDownOutline, optionsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-filter-disclosure',
  imports: [IonIcon],
  template: `
    <details #details class="filter-disclosure" [open]="expanded()" (toggle)="expanded.set(details.open)">
      <summary class="disclosure-summary">
        <ion-icon name="options-outline" aria-hidden="true" />
        <span
          ><strong>{{ heading() }}</strong
          ><small>{{ expanded() ? 'Ocultar filtros' : 'Mostrar filtros' }}</small></span
        >
        <ion-icon name="chevron-down-outline" aria-hidden="true" />
      </summary>
      <ng-content />
    </details>
  `,
})
export class FilterDisclosureComponent {
  readonly heading = input('Filtros de consulta');
  readonly expanded = signal(window.matchMedia('(min-width: 1024px)').matches);
  constructor() {
    addIcons({ chevronDownOutline, optionsOutline });
    const media = window.matchMedia('(min-width: 1024px)');
    const resize = () => this.expanded.set(media.matches);
    media.addEventListener('change', resize);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', resize));
  }
}
