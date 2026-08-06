import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/admin/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./modules/auth/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import(
        './shared/components/layout/main-layout.component'
      ).then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./modules/users/pages/user-list.component').then(
            (m) => m.UserListComponent
          ),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./modules/roles/pages/role-list.component').then(
            (m) => m.RoleListComponent
          ),
      },
      {
        path: 'permisos',
        loadComponent: () =>
          import(
            './modules/permissions/pages/permission-list.component'
          ).then((m) => m.PermissionListComponent),
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import(
            './modules/categories/pages/category-list.component'
          ).then((m) => m.CategoryListComponent),
      },
      {
        path: 'subcategorias',
        loadComponent: () =>
          import(
            './modules/subcategories/pages/subcategory-list.component'
          ).then((m) => m.SubcategoryListComponent),
      },
      {
        path: 'empleados',
        loadComponent: () =>
          import(
            './modules/employees/pages/employee-list.component'
          ).then((m) => m.EmployeeListComponent),
      },
      {
        path: 'proveedores',
        loadComponent: () =>
          import(
            './modules/providers/pages/provider-list.component'
          ).then((m) => m.ProviderListComponent),
      },
      {
        path: 'pqrs',
        loadComponent: () =>
          import('./modules/pqrs/pages/pqrs-list.component').then(
            (m) => m.PqrsListComponent
          ),
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./modules/audit/pages/audit-list.component').then(
            (m) => m.AuditListComponent
          ),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./modules/settings/pages/settings.component').then(
            (m) => m.SettingsComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/admin/dashboard',
  },
];
