import { Routes } from '@angular/router';

export const countryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/country-list.component').then(
        (m) => m.CountryListComponent
      ),
  },
];
