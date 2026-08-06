import {
  Component,
  OnInit,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
} from '../../../shared/components/data-table/data-table.types';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { UserService } from '../user.service';
import { RoleService } from '../../roles/role.service';
import { User } from '../../../core/models/user.interface';
import { Role } from '../../../core/models/role.interface';
import { UserFormComponent } from '../components/user-form.component';
import { UserChangeRoleComponent } from '../components/user-change-role.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    FormsModule,
    DataTableComponent,
  ],
  template: `
    <div class="user-list-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Gesti&oacute;n de Usuarios</h1>
          <span class="page-subtitle">{{ totalItems() }} usuarios registrados</span>
        </div>
        <div class="header-right">
          <mat-form-field appearance="outline" class="role-filter-field" subscriptSizing="dynamic">
            <mat-select
              [ngModel]="selectedRoleFilter()"
              (ngModelChange)="onRoleFilterChange($event)"
              placeholder="Filtrar por rol"
            >
              <mat-option [value]="null">Todos los roles</mat-option>
              @for (role of roles(); track role.id) {
                <mat-option [value]="role.id">{{ role.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="status-filter-field" subscriptSizing="dynamic">
            <mat-select
              [ngModel]="selectedStatusFilter()"
              (ngModelChange)="onStatusFilterChange($event)"
              placeholder="Filtrar por estado"
            >
              <mat-option [value]="null">Todos los estados</mat-option>
              <mat-option value="active">Activos</mat-option>
              <mat-option value="inactive">Inactivos</mat-option>
              <mat-option value="blocked">Bloqueados</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" class="add-btn" (click)="openCreateDialog()">
            <mat-icon>person_add</mat-icon>
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="users()"
        [totalItems]="totalItems()"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [title]="''"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por nombre, email o username...'"
        [showExport]="true"
        [showAddButton]="false"
        (sortChange)="onSortChange($event)"
        (pageChange)="onPageChange($event)"
        (searchChange)="onSearchChange($event)"
        (rowAction)="onRowAction($event)"
      ></app-data-table>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
        background: #f1f5f9;
        min-height: 100%;
      }

      .user-list-page {
        max-width: 1400px;
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 24px;
      }

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .page-title {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
      }

      .page-subtitle {
        font-size: 14px;
        color: #64748b;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .role-filter-field,
      .status-filter-field {
        width: 180px;

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
          display: none;
        }
      }

      .add-btn {
        height: 48px;
        border-radius: 8px;
        font-weight: 600;
        padding: 0 20px;
      }
    `,
  ],
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly users = signal<User[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(false);
  protected readonly totalItems = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly currentPage = signal(0);
  protected readonly selectedRoleFilter = signal<number | null>(null);
  protected readonly selectedStatusFilter = signal<string | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('');
  protected readonly sortDirection = signal<'asc' | 'desc' | ''>('');

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'username', label: 'Username', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'firstName', label: 'Nombre', sortable: true },
    { key: 'lastName', label: 'Apellido', sortable: true },
    { key: 'roleName', label: 'Rol', sortable: true },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      type: 'status',
      width: '120px',
      statusMap: {
        true: { label: 'Activo', color: '#22c55e' },
        false: { label: 'Inactivo', color: '#94a3b8' },
      },
    },
    {
      key: 'isBlocked',
      label: 'Bloqueo',
      sortable: true,
      type: 'status',
      width: '120px',
      statusMap: {
        true: { label: 'Bloqueado', color: '#ef4444' },
        false: { label: 'Desbloqueado', color: '#22c55e' },
      },
    },
    {
      key: 'lastLogin',
      label: 'Último Acceso',
      sortable: true,
      type: 'date',
      format: 'dd/MM/yyyy HH:mm',
      width: '170px',
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  ngOnInit(): void {
    this.loadRoles();
    this.loadUsers();
  }

  private buildQuery(): {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    search: string;
    filters: Record<string, unknown>;
  } {
    const filters: Record<string, unknown> = {};
    const roleFilter = this.selectedRoleFilter();
    if (roleFilter !== null) {
      filters['roleId'] = roleFilter;
    }
    const statusFilter = this.selectedStatusFilter();
    if (statusFilter !== null) {
      filters['status'] = statusFilter;
    }

    return {
      page: this.currentPage() + 1,
      limit: this.pageSize(),
      sortBy: this.sortActive(),
      sortOrder: this.sortDirection() || 'asc',
      search: this.searchTerm(),
      filters,
    };
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.userService
      .getAll(this.buildQuery())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (res) => {
          this.users.set(res?.items ?? []);
          this.totalItems.set(res?.total ?? 0);
        },
        error: () => {
          this.users.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar usuarios', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  private loadRoles(): void {
    this.roleService
      .getAll({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.roles.set(res?.items ?? []),
        error: () => {},
      });
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction);
    this.loadUsers();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadUsers();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadUsers();
  }

  protected onRoleFilterChange(roleId: number | null): void {
    this.selectedRoleFilter.set(roleId);
    this.currentPage.set(0);
    this.loadUsers();
  }

  protected onStatusFilterChange(status: string | null): void {
    this.selectedStatusFilter.set(status);
    this.currentPage.set(0);
    this.loadUsers();
  }

  protected onRowAction(event: RowAction<User>): void {
    const { action, row } = event;
    switch (action) {
      case 'edit':
        this.openEditDialog(row);
        break;
      case 'view':
        this.openChangeRoleDialog(row);
        break;
      case 'toggle':
        this.handleToggle(row);
        break;
      case 'delete':
        this.handleDelete(row);
        break;
    }
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open(UserFormComponent, {
      width: '560px',
      panelClass: 'form-dialog-panel',
      disableClose: true,
      autoFocus: false,
      data: { mode: 'create' },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadUsers();
        }
      });
  }

  private openEditDialog(user: User): void {
    const dialogRef = this.dialog.open(UserFormComponent, {
      width: '560px',
      panelClass: 'form-dialog-panel',
      disableClose: true,
      autoFocus: false,
      data: { mode: 'edit', user },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadUsers();
        }
      });
  }

  private openChangeRoleDialog(user: User): void {
    const dialogRef = this.dialog.open(UserChangeRoleComponent, {
      width: '440px',
      panelClass: 'form-dialog-panel',
      disableClose: true,
      autoFocus: false,
      data: { user },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadUsers();
        }
      });
  }

  private handleToggle(user: User): void {
    if (user.isBlocked) {
      this.handleUnblock(user);
    } else if (user.isActive) {
      this.handleBlock(user);
    } else {
      this.handleActivate(user);
    }
  }

  private handleDelete(user: User): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar Usuario',
        message: `¿Está seguro de eliminar al usuario "${this.userDisplayName(user)}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        icon: 'delete_forever',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.userService
            .delete(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.snackBar.open('Usuario eliminado correctamente', 'Cerrar', {
                  duration: 3000,
                  panelClass: 'snackbar-success',
                });
                this.loadUsers();
              },
              error: () => {
                this.snackBar.open('Error al eliminar usuario', 'Cerrar', {
                  duration: 5000,
                  panelClass: 'snackbar-error',
                });
              },
            });
        }
      });
  }

  private handleBlock(user: User): void {
    this.confirmDialog
      .confirm({
        title: 'Bloquear Usuario',
        message: `¿Está seguro de bloquear al usuario "${this.userDisplayName(user)}"? No podrá acceder al sistema.`,
        confirmText: 'Bloquear',
        icon: 'block',
        color: '#f59e0b',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.userService
            .block(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.snackBar.open('Usuario bloqueado correctamente', 'Cerrar', {
                  duration: 3000,
                  panelClass: 'snackbar-success',
                });
                this.loadUsers();
              },
              error: () => {
                this.snackBar.open('Error al bloquear usuario', 'Cerrar', {
                  duration: 5000,
                  panelClass: 'snackbar-error',
                });
              },
            });
        }
      });
  }

  private handleUnblock(user: User): void {
    this.confirmDialog
      .confirm({
        title: 'Desbloquear Usuario',
        message: `¿Está seguro de desbloquear al usuario "${this.userDisplayName(user)}"?`,
        confirmText: 'Desbloquear',
        icon: 'lock_open',
        color: '#22c55e',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.userService
            .unblock(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.snackBar.open('Usuario desbloqueado correctamente', 'Cerrar', {
                  duration: 3000,
                  panelClass: 'snackbar-success',
                });
                this.loadUsers();
              },
              error: () => {
                this.snackBar.open('Error al desbloquear usuario', 'Cerrar', {
                  duration: 5000,
                  panelClass: 'snackbar-error',
                });
              },
            });
        }
      });
  }

  private handleActivate(user: User): void {
    this.userService
      .activate(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Usuario activado correctamente', 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-success',
          });
          this.loadUsers();
        },
        error: () => {
          this.snackBar.open('Error al activar usuario', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  private userDisplayName(user: User): string {
    return [user.name, user.lastname].filter(Boolean).join(' ') || user.username;
  }
}
