import { Routes } from '@angular/router';

export const SUBCATEGORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/subcategory-list.component').then(
        (m) => m.SubcategoryListComponent
      ),
  },
];
