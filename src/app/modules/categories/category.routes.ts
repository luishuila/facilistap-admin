import { Routes } from '@angular/router';

export const CATEGORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/category-list.component').then(
        (m) => m.CategoryListComponent
      ),
  },
];
