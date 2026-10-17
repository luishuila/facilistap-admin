import { Component, ViewChild, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminProfile, AuthService, PanelAccess } from '../../../core/services/auth.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ChangePasswordDialogComponent } from '../change-password-dialog/change-password-dialog.component';

/** Cada cuanto se revisa que la sesion siga valida (IP, sesion cerrada, permisos). */
const ACCESS_CHECK_MS = 60_000;

interface NavItem {
  label: string;
  icon: string;
  route: string;
  children?: NavItem[];
  roles?: string[];
  /** Modulo del panel que exige (sin modulo = visible para todos, p. ej. Dashboard). */
  module?: string;
  /** Solo para el Super Admin (p. ej. Administrativos). */
  superAdminOnly?: boolean;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatBadgeModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <mat-sidenav-container class="layout-container" [class.is-mobile]="isMobile()">
      <mat-sidenav
        #sidenav
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="!isMobile()"
        class="sidebar"
        [class.collapsed]="sidebarCollapsed()"
      >
        <div class="sidebar-header">
          <div class="brand" [class.collapsed]="sidebarCollapsed()">
            <div class="brand-logo">
              <img src="logo-white.png" alt="FacilisTap" />
            </div>
            @if (!sidebarCollapsed()) {
              <div class="brand-texts">
                <span class="brand-text">FacilisTap</span>
                <span class="brand-sub">Panel administrativo</span>
              </div>
            }
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="user-info" [class.collapsed]="sidebarCollapsed()">
          <div class="user-avatar">
            <span class="avatar-text">{{ userInitials() }}</span>
          </div>
          @if (!sidebarCollapsed()) {
            <div class="user-details">
              <span class="user-name">{{ (currentUser()?.name ?? '') + ' ' + (currentUser()?.lastname ?? '') }}</span>
              <span class="user-role">{{ roleLabel() }}</span>
            </div>
          }
        </div>

        <mat-divider></mat-divider>

        <nav class="sidebar-nav">
          <mat-nav-list>
            @for (item of visibleNavItems(); track item.route) {
              @if (!item.children || item.children.length === 0) {
                <a
                  mat-list-item
                  [routerLink]="[item.route]"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="nav-item"
                  [matTooltip]="sidebarCollapsed() ? item.label : ''"
                  [matTooltipPosition]="'right'"
                >
                  <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                  @if (!sidebarCollapsed()) {
                    <span matListItemTitle>{{ item.label }}</span>
                  }
                </a>
              } @else if (sidebarCollapsed()) {
                <!-- Menu colapsado: solo iconos, sin encabezados de grupo. -->
                @for (child of item.children; track child.route) {
                  <a
                    mat-list-item
                    [routerLink]="[child.route]"
                    routerLinkActive="active"
                    class="nav-item"
                    [matTooltip]="item.label + ' / ' + child.label"
                    [matTooltipPosition]="'right'"
                  >
                    <mat-icon matListItemIcon>{{ child.icon }}</mat-icon>
                  </a>
                }
              } @else {
                <mat-list-item
                  (click)="toggleSubmenu(item)"
                  class="nav-item has-children"
                  [class.expanded]="isSubmenuExpanded(item)"
                  [class.group-active]="groupHasActive(item)"
                >
                  <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                  <span matListItemTitle>{{ item.label }}</span>
                  <span matListItemMeta class="expand-slot"><mat-icon class="expand-icon">expand_more</mat-icon></span>
                </mat-list-item>
                @if (isSubmenuExpanded(item)) {
                  @for (child of item.children; track child.route) {
                    <a
                      mat-list-item
                      [routerLink]="[child.route]"
                      routerLinkActive="active"
                      class="nav-item sub-item"
                    >
                      <mat-icon matListItemIcon>{{ child.icon }}</mat-icon>
                      <span matListItemTitle>{{ child.label }}</span>
                    </a>
                  }
                }
              }
            }
          </mat-nav-list>
        </nav>

        <div class="sidebar-footer">
          <mat-divider></mat-divider>
          @if (!sidebarCollapsed()) {
            <span class="version-text">v1.0.0</span>
          }
          <button
            mat-icon-button
            class="collapse-btn"
            (click)="toggleSidebarCollapse()"
            [matTooltip]="sidebarCollapsed() ? 'Expandir menú' : 'Colapsar menú'"
          >
            <mat-icon>{{ sidebarCollapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="main-wrapper">
        <mat-toolbar class="header-toolbar">
          <div class="toolbar-left">
            <button mat-icon-button (click)="sidenav.toggle()" class="menu-toggle">
              <mat-icon>menu</mat-icon>
            </button>
            <h1 class="page-title">{{ pageTitle() }}</h1>
          </div>

          <div class="toolbar-spacer"></div>

          <div class="toolbar-right">
            <button mat-icon-button [matBadge]="notificationsCount()" matBadgeColor="warn" [matTooltip]="'Notificaciones'">
              <mat-icon>notifications</mat-icon>
            </button>

            <button mat-icon-button [matMenuTriggerFor]="userMenu" class="user-menu-btn">
              <div class="toolbar-avatar">
            <span class="avatar-text">{{ userInitials() }}</span>
              </div>
            </button>
            <mat-menu #userMenu="matMenu" xPosition="before">
              <div class="user-menu-header">
                <span class="user-menu-name">{{ currentUser()?.name ?? 'Usuario' }}</span>
                <span class="user-menu-email">{{ currentUser()?.email ?? '' }}</span>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="openChangePassword()">
                <mat-icon>lock_reset</mat-icon>
                <span>Cambiar contraseña</span>
              </button>
              <button mat-menu-item (click)="logout()">
                <mat-icon>logout</mat-icon>
                <span>Cerrar Sesión</span>
              </button>
            </mat-menu>
          </div>
        </mat-toolbar>

        <main class="main-content">
          <router-outlet></router-outlet>
        </main>

        <footer class="app-footer">
          <span>&copy; {{ currentYear }} FacilisTap. Todos los derechos reservados.</span>
        </footer>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host {
        --sidebar-width: 280px;
        --sidebar-collapsed-width: 72px;
        /* Mismo estilo claro de la app Facilista: fondo blanco y azul de marca. */
        --sidebar-bg: var(--fac-surface);
        --sidebar-hover-bg: #f4f4f8;
        --sidebar-active-bg: var(--fac-primary-soft);
        --sidebar-active-border: var(--fac-primary);
        --sidebar-text: #4a4a4a;
        --sidebar-text-hover: var(--fac-text);
        --sidebar-icon: #8a8f98;
        --sidebar-icon-active: var(--fac-primary-shade);
        --header-height: 64px;
        --header-bg: var(--fac-surface);
        --header-border: var(--fac-border);
        --content-bg: var(--fac-bg);
        --footer-height: 48px;
        --footer-bg: var(--fac-surface);
        --footer-border: var(--fac-border);
        --accent-color: var(--fac-primary-shade);
        --accent-light: rgba(var(--fac-primary-rgb), 0.1);
        --transition-speed: 0.25s;
        display: block;
        height: 100%;
      }

      .layout-container {
        height: 100%;
        background-color: var(--content-bg);

        &.is-mobile {
          .sidebar {
            width: var(--sidebar-width);
          }
        }
      }

      .sidebar {
        width: var(--sidebar-width);
        background: var(--sidebar-bg);
        color: var(--sidebar-text);
        display: flex;
        flex-direction: column;
        transition: width var(--transition-speed) ease;
        overflow-x: hidden;
        border-right: 1px solid var(--fac-border);
        box-shadow: none;

        &.collapsed {
          width: var(--sidebar-collapsed-width);
        }

        ::ng-deep .mat-drawer-inner-container {
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }
      }

      .sidebar-header {
        padding: 20px 16px;
        display: flex;
        align-items: center;
        min-height: var(--header-height);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        white-space: nowrap;

        &.collapsed {
          justify-content: center;
          width: 100%;
        }
      }

      .brand-logo {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: var(--fac-gradient);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 6px 14px rgba(var(--fac-primary-rgb), 0.35);

        img {
          width: 34px;
          height: 34px;
          object-fit: contain;
        }
      }

      .brand-texts {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      .brand-text {
        font-size: 18px;
        font-weight: 700;
        color: var(--fac-text);
      }

      .brand-sub {
        font-size: 12px;
        color: var(--fac-text-muted);
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;

        &.collapsed {
          justify-content: center;
        }
      }

      .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--fac-gradient);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .avatar-text {
        color: #fff;
        font-weight: 600;
        font-size: 16px;
      }

      .user-details {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .user-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--sidebar-text-hover);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .user-role {
        font-size: 12px;
        color: var(--sidebar-icon);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sidebar-nav {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px 0;

        &::-webkit-scrollbar {
          width: 4px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.12);
          border-radius: 2px;
        }
      }

      .nav-item {
        margin: 2px 8px;
        border-radius: 8px;
        color: var(--sidebar-text) !important;
        transition: all 0.2s ease;
        height: 48px;
        border-left: 3px solid transparent;

        ::ng-deep .mat-mdc-list-item-unscoped-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mat-icon {
          color: var(--sidebar-icon);
          transition: color 0.2s ease;
        }

        &:hover {
          background: var(--sidebar-hover-bg);
          color: var(--sidebar-text-hover) !important;

          .mat-icon {
            color: var(--sidebar-text-hover);
          }
        }

        &.active {
          background: var(--sidebar-active-bg);
          color: var(--fac-primary-deep) !important;
          border-left-color: var(--sidebar-active-border);
          font-weight: 600;

          .mat-icon {
            color: var(--sidebar-icon-active);
          }
        }

        &.sub-item {
          padding-left: 40px;

          ::ng-deep .mdc-list-item__start {
            margin-right: 8px;
          }

          .mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          .mat-mdc-list-item-title {
            font-size: 13px;
          }
        }
      }

      .has-children {
        cursor: pointer;

        .expand-slot {
          display: flex;
          align-items: center;
        }

        .expand-icon {
          font-size: 20px;
          transition: transform 0.2s ease;
        }

        &.expanded .expand-icon {
          transform: rotate(180deg);
        }

        /* El grupo de la pagina abierta se marca aunque este cerrado. */
        &.group-active {
          color: var(--fac-primary-deep) !important;
          font-weight: 600;

          .mat-icon {
            color: var(--sidebar-icon-active);
          }
        }
      }

      .sidebar-footer {
        padding: 12px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .version-text {
        font-size: 12px;
        color: var(--sidebar-icon);
        margin-left: 8px;
      }

      .collapse-btn {
        color: var(--sidebar-icon);

        &:hover {
          color: var(--sidebar-text-hover);
        }
      }

      .main-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .header-toolbar {
        background: var(--header-bg);
        border-bottom: 1px solid var(--header-border);
        height: var(--header-height);
        padding: 0 24px;
        display: flex;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 10;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }

      .toolbar-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .menu-toggle {
        color: var(--fac-primary-shade);
      }

      .page-title {
        font-size: 20px;
        font-weight: 600;
        color: var(--fac-text);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .toolbar-spacer {
        flex: 1;
      }

      .toolbar-right {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .toolbar-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--fac-gradient);
        display: flex;
        align-items: center;
        justify-content: center;

        span {
          color: #fff;
          font-weight: 600;
          font-size: 14px;
        }
      }

      .user-menu-btn {
        padding: 0;
      }

      .user-menu-header {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;

        .user-menu-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--fac-text);
        }

        .user-menu-email {
          font-size: 12px;
          color: var(--fac-text-muted);
        }
      }

      .main-content {
        flex: 1;
        overflow-y: auto;
        background: var(--content-bg);
      }

      .app-footer {
        height: var(--footer-height);
        background: var(--footer-bg);
        border-top: 1px solid var(--footer-border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        color: var(--fac-text-muted);
        padding: 0 24px;
      }

      ::ng-deep {
        .sidebar .mat-divider {
          border-top-color: var(--fac-border);
        }

        .mat-mdc-list-item-title {
          font-size: 14px !important;
          font-weight: 500 !important;
        }
      }
    `,
  ],
})
export class MainLayoutComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly currentUser = signal<AdminProfile | null>(null);
  /** Permisos del panel del usuario (SUPER_ADMIN ve todo). */
  protected readonly access = signal<PanelAccess | null>(null);
  protected readonly isMobile = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly pageTitle = signal('Dashboard');
  protected readonly notificationsCount = signal(0);
  protected readonly expandedSubmenus = signal<Set<string>>(new Set());
  protected readonly currentYear = new Date().getFullYear();

  /** Menu en acordeon: un solo grupo abierto; se abre solo el de la pagina actual. */
  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard' },
    {
      label: 'Usuarios y accesos', icon: 'people', route: 'group:users',
      children: [
        { label: 'Usuarios', icon: 'person', route: '/admin/usuarios', module: 'users' },
        { label: 'Roles', icon: 'admin_panel_settings', route: '/admin/roles', module: 'roles' },
        { label: 'Permisos', icon: 'security', route: '/admin/permisos', module: 'permissions' },
      ],
    },
    {
      label: 'Catálogo', icon: 'category', route: 'group:catalog',
      children: [
        { label: 'Categorías', icon: 'category', route: '/admin/categorias', module: 'categories' },
        { label: 'Subcategorías', icon: 'subdirectory_arrow_right', route: '/admin/subcategorias', module: 'subcategories' },
      ],
    },
    {
      label: 'Ubicaciones', icon: 'public', route: 'group:geo',
      children: [
        { label: 'Países', icon: 'flag', route: '/admin/paises', module: 'countries' },
        { label: 'Departamentos', icon: 'map', route: '/admin/departamentos', module: 'states' },
        { label: 'Ciudades', icon: 'location_city', route: '/admin/ciudades', module: 'cities' },
      ],
    },
    {
      label: 'Negocio', icon: 'storefront', route: 'group:business',
      children: [
        { label: 'Proveedores', icon: 'local_shipping', route: '/admin/proveedores', module: 'providers' },
        { label: 'Empleados', icon: 'badge', route: '/admin/empleados', module: 'employees' },
        { label: 'Roles de empleados', icon: 'assignment_ind', route: '/admin/roles-empleados', module: 'employee_roles' },
        { label: 'Suscripciones', icon: 'workspace_premium', route: '/admin/suscripciones', module: 'subscriptions' },
        { label: 'Tienda y liquidaciones', icon: 'storefront', route: '/admin/tienda', module: 'store' },
        { label: 'Billetera', icon: 'account_balance_wallet', route: '/admin/billetera', module: 'store' },
        { label: 'Promociones', icon: 'local_offer', route: '/admin/promociones', module: 'promotions' },
      ],
    },
    {
      label: 'Atención', icon: 'support_agent', route: 'group:support',
      children: [
        { label: 'PQRS', icon: 'feedback', route: '/admin/pqrs', module: 'pqrs' },
        { label: 'Verificaciones', icon: 'verified', route: '/admin/verificaciones', module: 'verifications' },
        { label: 'Notificaciones', icon: 'campaign', route: '/admin/notificaciones', module: 'notifications' },
      ],
    },
    {
      label: 'Seguridad', icon: 'shield', route: 'group:security',
      children: [
        { label: 'Administrativos', icon: 'manage_accounts', route: '/admin/administrativos', superAdminOnly: true },
        { label: 'IPs permitidas', icon: 'vpn_lock', route: '/admin/ips-permitidas', superAdminOnly: true },
        { label: 'Auditoría', icon: 'history', route: '/admin/auditoria', module: 'audit' },
      ],
    },
    {
      label: 'Sistema', icon: 'tune', route: 'group:system',
      children: [
        { label: 'Idiomas', icon: 'translate', route: '/admin/idiomas', module: 'languages' },
        { label: 'Menú de la app', icon: 'menu_open', route: '/admin/menu-app', module: 'menu' },
        { label: 'Tabla maestra', icon: 'table_chart', route: '/admin/tabla-maestra', module: 'maestra' },
        { label: 'Configuración', icon: 'settings', route: '/admin/configuracion', module: 'settings' },
      ],
    },
  ];

  /** Menu segun los modulos permitidos. */
  protected readonly visibleNavItems = computed(() => {
    this.access();
    const allowed = (item: NavItem) =>
      item.superAdminOnly ? this.authService.isSuperAdmin() : this.authService.canAccess(item.module);
    // Grupos: solo con sus opciones permitidas; un grupo sin opciones no se muestra.
    return this.navItems
      .map((item) => (item.children ? { ...item, children: item.children.filter(allowed) } : item))
      .filter((item) => (item.children ? item.children.length > 0 : allowed(item)));
  });

  /** Ruta actual (sin query) para marcar el grupo que contiene la pagina abierta. */
  private readonly currentPath = signal('');

  protected groupHasActive(item: NavItem): boolean {
    const path = this.currentPath();
    return !!item.children?.some((c) => path === c.route || path.startsWith(`${c.route}/`));
  }

  /** Tipo de cuenta del panel. */
  protected readonly roleLabel = computed(() => (this.currentUser()?.isSuperAdmin ? 'Super Admin' : 'Administrativo'));

  protected readonly userInitials = computed(() => {
    const name = this.currentUser()?.name;
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  });

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser.set(user);
    });

    // Permisos al dia: si un Super Admin cambio los del rol, el menu se actualiza al entrar.
    this.authService.access$.subscribe((access) => this.access.set(access));
    this.checkAccess();
    // Sesion cerrada por un Super Admin, IP ya no permitida o permisos cambiados:
    // se revisa cada minuto y al volver a la pestaña (el interceptor saca al login).
    const timer = setInterval(() => this.checkAccess(), ACCESS_CHECK_MS);
    const onVisible = () => document.visibilityState === 'visible' && this.checkAccess();
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });

    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .subscribe((result) => {
        this.isMobile.set(result.matches);
      });

    // Titulo del encabezado = opcion del menu que coincide con la ruta actual.
    this.updatePageTitle(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updatePageTitle(e.urlAfterRedirects));
  }

  private checkAccess(): void {
    if (!this.authService.isAuthenticated()) return;
    this.authService.refreshAccess().subscribe({
      next: () => {
        if (!this.authService.hasPanelAccess()) {
          this.authService.endLocalSession();
          void this.router.navigate(['/auth/login'], { queryParams: { denied: 1 } });
        }
      },
      error: () => undefined,
    });
  }

  private updatePageTitle(url: string): void {
    const path = url.split(/[?#]/)[0];
    const items = this.navItems.flatMap((item) => [item, ...(item.children ?? [])]);
    const match = items.find((item) => path === item.route || path.startsWith(`${item.route}/`));
    this.pageTitle.set(match?.label ?? 'Dashboard');
    this.currentPath.set(path);
    // Acordeon: abre el grupo de la pagina actual (y cierra los demas).
    const group = this.navItems.find((g) => g.children?.some((c) => path === c.route || path.startsWith(`${c.route}/`)));
    if (group) this.expandedSubmenus.set(new Set([group.route]));
  }

  /** Acordeon: abrir un grupo cierra el que estaba abierto. */
  toggleSubmenu(item: NavItem): void {
    this.expandedSubmenus.set(this.isSubmenuExpanded(item) ? new Set() : new Set([item.route]));
  }

  isSubmenuExpanded(item: NavItem): boolean {
    return this.expandedSubmenus().has(item.route);
  }

  toggleSidebarCollapse(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  openChangePassword(): void {
    this.dialog.open(ChangePasswordDialogComponent, { width: '440px', maxWidth: '95vw', autoFocus: false });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: () => {
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
