import { Routes } from '@angular/router';

export const cityRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/city-list.component').then(
        (m) => m.CityListComponent
      ),
  },
];
