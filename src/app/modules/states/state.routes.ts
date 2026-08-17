import { Routes } from '@angular/router';

export const stateRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/state-list.component').then(
        (m) => m.StateListComponent
      ),
  },
];
