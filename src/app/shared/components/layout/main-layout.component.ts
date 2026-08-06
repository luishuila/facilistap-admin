import { Component, ViewChild, OnInit, inject, signal, computed } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
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
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.interface';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  children?: NavItem[];
  roles?: string[];
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
            <mat-icon class="brand-icon">admin_panel_settings</mat-icon>
            @if (!sidebarCollapsed()) {
              <span class="brand-text">FacilisTap Admin</span>
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
              <span class="user-name">{{ currentUser()?.username ?? 'Usuario' }}</span>
              <span class="user-role">{{ currentUser()?.roleName ?? 'Sin rol' }}</span>
            </div>
          }
        </div>

        <mat-divider></mat-divider>

        <nav class="sidebar-nav">
          <mat-nav-list>
            @for (item of navItems; track item.route) {
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
              } @else {
                <mat-list-item
                  (click)="toggleSubmenu(item)"
                  class="nav-item has-children"
                  [class.expanded]="isSubmenuExpanded(item)"
                >
                  <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                  @if (!sidebarCollapsed()) {
                    <span matListItemTitle>{{ item.label }}</span>
                  }
                  @if (!sidebarCollapsed()) {
                    <mat-icon class="expand-icon">
                      {{ isSubmenuExpanded(item) ? 'expand_less' : 'expand_more' }}
                    </mat-icon>
                  }
                </mat-list-item>
                @if (isSubmenuExpanded(item) && !sidebarCollapsed()) {
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
                <span class="user-menu-name">{{ currentUser()?.username ?? 'Usuario' }}</span>
                <span class="user-menu-email">{{ currentUser()?.username ?? '' }}</span>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="navigateToProfile()">
                <mat-icon>person</mat-icon>
                <span>Perfil</span>
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
        --sidebar-bg: #1e293b;
        --sidebar-hover-bg: #334155;
        --sidebar-active-bg: rgba(59, 130, 246, 0.15);
        --sidebar-active-border: #3b82f6;
        --sidebar-text: #cbd5e1;
        --sidebar-text-hover: #f1f5f9;
        --sidebar-icon: #94a3b8;
        --sidebar-icon-active: #3b82f6;
        --header-height: 64px;
        --header-bg: #ffffff;
        --header-border: #e2e8f0;
        --content-bg: #f1f5f9;
        --footer-height: 48px;
        --footer-bg: #ffffff;
        --footer-border: #e2e8f0;
        --accent-color: #3b82f6;
        --accent-light: rgba(59, 130, 246, 0.1);
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
        border-right: none;
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);

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

      .brand-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: var(--accent-color);
        flex-shrink: 0;
      }

      .brand-text {
        font-size: 18px;
        font-weight: 700;
        color: var(--sidebar-text-hover);
        letter-spacing: 0.5px;
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
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
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
          background: rgba(255, 255, 255, 0.1);
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
          color: var(--accent-color) !important;
          border-left-color: var(--sidebar-active-border);

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

        .expand-icon {
          margin-left: auto;
          font-size: 20px;
          transition: transform 0.2s ease;
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
        color: #64748b;
      }

      .page-title {
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
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
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
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
          color: #1e293b;
        }

        .user-menu-email {
          font-size: 12px;
          color: #64748b;
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
        color: #64748b;
        padding: 0 24px;
      }

      ::ng-deep {
        .mat-divider {
          border-top-color: rgba(255, 255, 255, 0.08);
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

  protected readonly currentUser = signal<User | null>(null);
  protected readonly isMobile = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly pageTitle = signal('Dashboard');
  protected readonly notificationsCount = signal(0);
  protected readonly expandedSubmenus = signal<Set<string>>(new Set());
  protected readonly currentYear = new Date().getFullYear();

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard' },
    { label: 'Gestión de Usuarios', icon: 'people', route: '/admin/usuarios' },
    { label: 'Gestión de Roles', icon: 'admin_panel_settings', route: '/admin/roles' },
    { label: 'Gestión de Permisos', icon: 'security', route: '/admin/permisos' },
    { label: 'Gestión de Categorías', icon: 'category', route: '/admin/categorias' },
    { label: 'Gestión de Subcategorías', icon: 'subdirectory_arrow_right', route: '/admin/subcategorias' },
    { label: 'Gestión de Empleados', icon: 'badge', route: '/admin/empleados' },
    { label: 'Gestión de Proveedores', icon: 'local_shipping', route: '/admin/proveedores' },
    { label: 'Gestión de PQRS', icon: 'feedback', route: '/admin/pqrs' },
    { label: 'Auditoría', icon: 'history', route: '/admin/auditoria' },
    { label: 'Configuración', icon: 'settings', route: '/admin/configuracion' },
  ];

  protected readonly userInitials = computed(() => {
    const username = this.currentUser()?.username;
    if (!username) return 'U';
    return username.charAt(0).toUpperCase();
  });

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser.set(user);
    });

    this.breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .subscribe((result) => {
        this.isMobile.set(result.matches);
      });
  }

  toggleSubmenu(item: NavItem): void {
    const current = new Set(this.expandedSubmenus());
    if (current.has(item.route)) {
      current.delete(item.route);
    } else {
      current.add(item.route);
    }
    this.expandedSubmenus.set(current);
  }

  isSubmenuExpanded(item: NavItem): boolean {
    return this.expandedSubmenus().has(item.route);
  }

  toggleSidebarCollapse(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  navigateToProfile(): void {
    this.router.navigate(['/admin/perfil']);
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
