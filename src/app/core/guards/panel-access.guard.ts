import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Ruta de cada modulo del panel (para mandar al primero permitido). */
export const PANEL_MODULE_ROUTES: Record<string, string> = {
  users: '/admin/usuarios',
  roles: '/admin/roles',
  permissions: '/admin/permisos',
  categories: '/admin/categorias',
  subcategories: '/admin/subcategorias',
  countries: '/admin/paises',
  states: '/admin/departamentos',
  cities: '/admin/ciudades',
  employees: '/admin/empleados',
  providers: '/admin/proveedores',
  employee_roles: '/admin/roles-empleados',
  pqrs: '/admin/pqrs',
  subscriptions: '/admin/suscripciones',
  notifications: '/admin/notificaciones',
  promotions: '/admin/promociones',
  audit: '/admin/auditoria',
  languages: '/admin/idiomas',
  settings: '/admin/configuracion',
  maestra: '/admin/tabla-maestra',
  menu: '/admin/menu-app',
};

/**
 * Todo /admin: SUPER_ADMIN o personal con al menos un modulo permitido.
 * Una sesion sin acceso (p. ej. le quitaron los permisos) se cierra y vuelve al login.
 */
export const panelAccessGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }
  // Cuenta nueva o clave restablecida: primero cambia la contraseña (en la pantalla de login).
  if (authService.mustChangePassword()) {
    return router.createUrlTree(['/auth/login']);
  }
  if (authService.hasPanelAccess()) {
    return true;
  }

  authService.logout().subscribe({ error: () => authService.endLocalSession() });
  return router.createUrlTree(['/auth/login'], { queryParams: { denied: 1 } });
};

/** Cada pantalla: `data: { panelModule: 'users' }`. Sin permiso, al primer modulo permitido. */
export const panelModuleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const module = route.data?.['panelModule'] as string | undefined;
  const superAdminOnly = route.data?.['superAdminOnly'] === true;

  if (superAdminOnly ? authService.isSuperAdmin() : authService.canAccess(module)) {
    return true;
  }
  const first = Object.keys(PANEL_MODULE_ROUTES).find((m) => authService.canAccess(m));
  return router.createUrlTree([first ? PANEL_MODULE_ROUTES[first] : '/admin/dashboard']);
};
