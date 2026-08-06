import { Routes } from '@angular/router';

export const PQRS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/pqrs-list.component').then(m => m.PqrsListComponent) },
];
