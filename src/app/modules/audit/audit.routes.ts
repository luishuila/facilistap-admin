import { Routes } from '@angular/router';

export const AUDIT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/audit-list.component').then(m => m.AuditListComponent) },
];
