import type { Routes } from '@angular/router';

import { guestGuard, roleGuard, sessionGuard } from './core/auth.guards';
import { REGISTER_ROLES, SEARCH_ROLES } from './core/contracts';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'app',
    canActivate: [sessionGuard],
    canActivateChild: [roleGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'panel',
        data: { roles: ['MEDICO'] },
        loadComponent: () => import('./panel/panel.page').then((m) => m.PanelPage),
      },
      {
        path: 'audit',
        data: { roles: ['AUDITOR'] },
        loadComponent: () => import('./audit/audit.page').then((m) => m.AuditPage),
      },
      { path: 'home', loadComponent: () => import('./home/home.page').then((m) => m.HomePage) },
      {
        path: 'register',
        data: { roles: REGISTER_ROLES },
        loadComponent: () => import('./patients/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'search',
        data: { roles: SEARCH_ROLES },
        loadComponent: () => import('./patients/search.page').then((m) => m.SearchPage),
      },
      { path: 'beds', loadComponent: () => import('./beds/beds.page').then((m) => m.BedsPage) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  {
    path: '',
    redirectTo: 'app/home',
    pathMatch: 'full',
  },
  { path: '**', redirectTo: 'app/home' },
];
