import { panelModuleGuard } from '../../core/guards/panel-access.guard';
import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'usuarios',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'users' },
    loadComponent: () =>
      import('./pages/users/user-list.component').then((m) => m.UserListComponent),
  },
  {
    path: 'roles',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'roles' },
    loadComponent: () =>
      import('./pages/roles/role-list.component').then((m) => m.RoleListComponent),
  },
  {
    path: 'permisos',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'permissions' },
    loadComponent: () =>
      import('./pages/permissions/permission-list.component').then((m) => m.PermissionListComponent),
  },
  {
    path: 'categorias',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'categories' },
    loadComponent: () =>
      import('./pages/categories/category-list.component').then((m) => m.CategoryListComponent),
  },
  {
    path: 'subcategorias',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'subcategories' },
    loadComponent: () =>
      import('./pages/subcategories/subcategory-list.component').then((m) => m.SubcategoryListComponent),
  },
  {
    path: 'empleados',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'employees' },
    loadComponent: () =>
      import('./pages/employees/employee-list.component').then((m) => m.EmployeeListComponent),
  },
  {
    path: 'proveedores',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'providers' },
    loadComponent: () =>
      import('./pages/providers/provider-list.component').then((m) => m.ProviderListComponent),
  },
  {
    path: 'pqrs',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'pqrs' },
    loadComponent: () =>
      import('./pages/pqrs/pqrs-list.component').then((m) => m.PqrsListComponent),
  },
  {
    path: 'billetera',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'store' },
    loadComponent: () =>
      import('./pages/store/wallet-config.component').then((m) => m.WalletConfigComponent),
  },
  {
    path: 'tienda',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'store' },
    loadComponent: () =>
      import('./pages/store/store-payments.component').then((m) => m.StorePaymentsComponent),
  },
  {
    path: 'verificaciones',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'verifications' },
    loadComponent: () =>
      import('./pages/verifications/verification-list.component').then((m) => m.VerificationListComponent),
  },
  {
    path: 'paises',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'countries' },
    loadComponent: () =>
      import('./pages/countries/country-list.component').then((m) => m.CountryListComponent),
  },
  {
    path: 'departamentos',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'states' },
    loadComponent: () =>
      import('./pages/states/state-list.component').then((m) => m.StateListComponent),
  },
  {
    path: 'ciudades',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'cities' },
    loadComponent: () =>
      import('./pages/cities/city-list.component').then((m) => m.CityListComponent),
  },
  {
    path: 'suscripciones',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'subscriptions' },
    loadComponent: () =>
      import('./pages/subscriptions/subscription-list.component').then((m) => m.SubscriptionListComponent),
  },
  {
    path: 'promociones',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'promotions' },
    loadComponent: () =>
      import('./pages/promotions/promotion-admin.component').then((m) => m.PromotionAdminComponent),
  },
  {
    path: 'notificaciones',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'notifications' },
    loadComponent: () =>
      import('./pages/notifications/notification-broadcast.component').then((m) => m.NotificationBroadcastComponent),
  },
  {
    path: 'auditoria',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'audit' },
    loadComponent: () =>
      import('./pages/audit/audit-list.component').then((m) => m.AuditListComponent),
  },
  {
    path: 'administrativos',
    canActivate: [panelModuleGuard],
    data: { superAdminOnly: true },
    loadComponent: () => import('./pages/staff/staff-list.component').then((m) => m.StaffListComponent),
  },
  {
    path: 'roles-empleados',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'employee_roles' },
    loadComponent: () =>
      import('./pages/employee-roles/employee-role-list.component').then((m) => m.EmployeeRoleListComponent),
  },
  {
    path: 'tabla-maestra',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'maestra' },
    loadComponent: () => import('./pages/maestra/maestra-list.component').then((m) => m.MaestraListComponent),
  },
  {
    path: 'menu-app',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'menu' },
    loadComponent: () => import('./pages/app-menu/app-menu-list.component').then((m) => m.AppMenuListComponent),
  },
  {
    path: 'ips-permitidas',
    canActivate: [panelModuleGuard],
    data: { superAdminOnly: true },
    loadComponent: () => import('./pages/allowed-ips/allowed-ip-list.component').then((m) => m.AllowedIpListComponent),
  },
  {
    path: 'idiomas',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'languages' },
    loadComponent: () =>
      import('./pages/languages/language-list.component').then((m) => m.LanguageListComponent),
  },
  {
    path: 'configuracion',
    canActivate: [panelModuleGuard],
    data: { panelModule: 'settings' },
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
];
