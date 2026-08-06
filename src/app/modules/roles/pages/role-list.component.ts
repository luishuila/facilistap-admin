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
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
} from '../../../shared/components/data-table/data-table.types';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { RoleService } from '../role.service';
import { Role } from '../../../core/models/role.interface';
import { RoleFormComponent } from '../components/role-form.component';
import { RolePermissionsComponent } from '../components/role-permissions.component';

@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DataTableComponent,
  ],
  template: `
    <div class="role-list-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Gesti&oacute;n de Roles</h1>
          <span class="page-subtitle">{{ totalItems() }} roles registrados</span>
        </div>
        <div class="header-right">
          <button mat-flat-button color="primary" class="add-btn" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon>
            <span>Nuevo Rol</span>
          </button>
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="roles()"
        [totalItems]="totalItems()"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [title]="''"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por nombre o descripción...'"
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

      .role-list-page {
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
export class RoleListComponent implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(false);
  protected readonly totalItems = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly currentPage = signal(0);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('');
  protected readonly sortDirection = signal<'asc' | 'desc' | ''>('');

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'description', label: 'Descripción', sortable: true },
    {
      key: 'permissions',
      label: 'Permisos',
      sortable: false,
      type: 'number',
      width: '100px',
      align: 'center',
    },
    {
      key: 'userCount',
      label: 'Usuarios',
      sortable: true,
      type: 'number',
      width: '100px',
      align: 'center',
    },
    {
      key: 'isSystem',
      label: 'Sistema',
      sortable: true,
      type: 'boolean',
      width: '100px',
      align: 'center',
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  ngOnInit(): void {
    this.loadRoles();
  }

  private buildQuery(): {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    search: string;
    filters?: Record<string, unknown>;
  } {
    return {
      page: this.currentPage() + 1,
      limit: this.pageSize(),
      sortBy: this.sortActive(),
      sortOrder: this.sortDirection() || 'asc',
      search: this.searchTerm(),
    };
  }

  private loadRoles(): void {
    this.loading.set(true);
    this.roleService
      .getAll(this.buildQuery())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (res) => {
          const items = (res?.items ?? []).map((role) => ({
            ...role,
            permissions: role.permissions?.length || 0,
          }));
          this.roles.set(items as unknown as Role[]);
          this.totalItems.set(res?.total ?? 0);
        },
        error: () => {
          this.roles.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar roles', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction);
    this.loadRoles();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadRoles();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadRoles();
  }

  protected onRowAction(event: RowAction<Role>): void {
    const { action, row } = event;
    switch (action) {
      case 'edit':
        this.openEditDialog(row);
        break;
      case 'view':
        this.openPermissionsDialog(row);
        break;
      case 'toggle':
        break;
      case 'delete':
        this.handleDelete(row);
        break;
    }
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open(RoleFormComponent, {
      width: '500px',
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
          this.loadRoles();
        }
      });
  }

  private openEditDialog(role: Role): void {
    const dialogRef = this.dialog.open(RoleFormComponent, {
      width: '500px',
      panelClass: 'form-dialog-panel',
      disableClose: true,
      autoFocus: false,
      data: { mode: 'edit', role },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadRoles();
        }
      });
  }

  private openPermissionsDialog(role: Role): void {
    const dialogRef = this.dialog.open(RolePermissionsComponent, {
      width: '700px',
      maxHeight: '80vh',
      panelClass: 'form-dialog-panel',
      disableClose: true,
      autoFocus: false,
      data: { role },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadRoles();
        }
      });
  }

  private handleDelete(role: Role): void {
    if (role.isSystem) {
      this.snackBar.open('No se puede eliminar un rol de sistema', 'Cerrar', {
        duration: 5000,
        panelClass: 'snackbar-warning',
      });
      return;
    }

    this.confirmDialog
      .confirm({
        title: 'Eliminar Rol',
        message: `¿Está seguro de eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        icon: 'delete_forever',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.roleService
            .delete(role.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.snackBar.open('Rol eliminado correctamente', 'Cerrar', {
                  duration: 3000,
                  panelClass: 'snackbar-success',
                });
                this.loadRoles();
              },
              error: () => {
                this.snackBar.open('Error al eliminar rol', 'Cerrar', {
                  duration: 5000,
                  panelClass: 'snackbar-error',
                });
              },
            });
        }
      });
  }
}
