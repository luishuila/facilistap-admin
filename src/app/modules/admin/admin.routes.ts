import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'usuarios',
    loadComponent: () =>
      import('./pages/users/user-list.component').then((m) => m.UserListComponent),
  },
  {
    path: 'roles',
    loadComponent: () =>
      import('./pages/roles/role-list.component').then((m) => m.RoleListComponent),
  },
  {
    path: 'permisos',
    loadComponent: () =>
      import('./pages/permissions/permission-list.component').then((m) => m.PermissionListComponent),
  },
  {
    path: 'categorias',
    loadComponent: () =>
      import('./pages/categories/category-list.component').then((m) => m.CategoryListComponent),
  },
  {
    path: 'subcategorias',
    loadComponent: () =>
      import('./pages/subcategories/subcategory-list.component').then((m) => m.SubcategoryListComponent),
  },
  {
    path: 'empleados',
    loadComponent: () =>
      import('./pages/employees/employee-list.component').then((m) => m.EmployeeListComponent),
  },
  {
    path: 'proveedores',
    loadComponent: () =>
      import('./pages/providers/provider-list.component').then((m) => m.ProviderListComponent),
  },
  {
    path: 'pqrs',
    loadComponent: () =>
      import('./pages/pqrs/pqrs-list.component').then((m) => m.PqrsListComponent),
  },
  {
    path: 'paises',
    loadComponent: () =>
      import('./pages/countries/country-list.component').then((m) => m.CountryListComponent),
  },
  {
    path: 'departamentos',
    loadComponent: () =>
      import('./pages/states/state-list.component').then((m) => m.StateListComponent),
  },
  {
    path: 'ciudades',
    loadComponent: () =>
      import('./pages/cities/city-list.component').then((m) => m.CityListComponent),
  },
  {
    path: 'auditoria',
    loadComponent: () =>
      import('./pages/audit/audit-list.component').then((m) => m.AuditListComponent),
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
];
