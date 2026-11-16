import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  gridOutline,
  personAddOutline,
  searchOutline,
  bedOutline,
  logOutOutline,
  shieldCheckmarkOutline,
  medicalOutline,
} from 'ionicons/icons';

import { REGISTER_ROLES, ROLE_NAMES, SEARCH_ROLES } from '../core/contracts';
import { SessionService } from '../core/session.service';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IonIcon],
})
export class ShellComponent {
  readonly session = inject(SessionService);
  readonly roleName = computed(() => (this.session.role() ? ROLE_NAMES[this.session.role()!] : ''));
  readonly links = computed(() =>
    [
      { path: '/app/home', label: 'Inicio', mobileLabel: 'Inicio', icon: 'grid-outline', show: true },
      {
        path: '/app/panel',
        label: 'Panel médico',
        mobileLabel: 'Panel',
        icon: 'medical-outline',
        show: this.session.role() === 'MEDICO',
      },
      {
        path: '/app/audit',
        label: 'Auditoría',
        mobileLabel: 'Auditoría',
        icon: 'shield-checkmark-outline',
        show: this.session.role() === 'AUDITOR',
      },
      {
        path: '/app/register',
        label: 'Registrar paciente',
        mobileLabel: 'Registro',
        icon: 'person-add-outline',
        show: this.session.hasRole(REGISTER_ROLES),
      },
      {
        path: '/app/search',
        label: 'Buscar paciente',
        mobileLabel: 'Buscar',
        icon: 'search-outline',
        show: this.session.hasRole(SEARCH_ROLES),
      },
      { path: '/app/beds', label: 'Censo de camas', mobileLabel: 'Camas', icon: 'bed-outline', show: true },
    ].filter((link) => link.show),
  );
  constructor() {
    addIcons({
      gridOutline,
      personAddOutline,
      searchOutline,
      bedOutline,
      logOutOutline,
      shieldCheckmarkOutline,
      medicalOutline,
    });
  }
}
