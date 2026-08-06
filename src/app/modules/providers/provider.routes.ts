import { Routes } from '@angular/router';

export const PROVIDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/provider-list.component').then(
        (m) => m.ProviderListComponent
      ),
  },
];
