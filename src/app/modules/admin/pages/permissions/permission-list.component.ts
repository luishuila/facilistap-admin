import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { PermissionService } from '../../services/permission.service';
import { Permission } from '../../../../core/models/permission.interface';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
} from '../../../../shared/components/data-table/data-table.types';
import { PermissionFormComponent } from './permission-form.component';

@Component({
  selector: 'app-permission-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permission-list.component.html',
  styleUrls: ['./permission-list.component.scss'],
})
export class PermissionListComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly permissions = signal<Permission[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('name');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');
  protected readonly moduleFilter = signal('');
  protected readonly availableModules = signal<string[]>([]);

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'description', label: 'Descripción' },
    {
      key: 'module',
      label: 'Módulo',
      sortable: true,
      type: 'status',
      width: '140px',
      align: 'center',
      statusMap: {},
    },
    {
      key: 'action',
      label: 'Acción',
      sortable: true,
      type: 'status',
      width: '120px',
      align: 'center',
      statusMap: {
        CREATE: { label: 'Create', color: '#22c55e' },
        READ: { label: 'Read', color: '#3b82f6' },
        UPDATE: { label: 'Update', color: '#f59e0b' },
        DELETE: { label: 'Delete', color: '#ef4444' },
      },
    },
    {
      key: 'rolesCount',
      label: 'Roles',
      sortable: true,
      type: 'number',
      width: '90px',
      align: 'center',
    },
    {
      key: 'actions',
      label: 'Acciones',
      type: 'actions',
      width: '80px',
      align: 'center',
    },
  ];

  ngOnInit(): void {
    this.loadPermissions();
    this.loadModules();
  }

  protected loadPermissions(): void {
    this.loading.set(true);

    const filters: Record<string, unknown> = {};
    if (this.moduleFilter()) {
      filters['module'] = this.moduleFilter();
    }

    this.permissionService
      .getAll({
        page: this.currentPage() + 1,
        limit: this.pageSize(),
        search: this.searchTerm() || undefined,
        sortBy: this.sortActive(),
        sortOrder: this.sortDirection(),
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.permissions.set(res?.items ?? []);
          this.totalItems.set(res?.total ?? 0);

          const dynamicModuleMap: Record<string, { label: string; color: string }> = {};
          const moduleColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316', '#ec4899'];
          const allModules = [...new Set((res?.items ?? []).map((p) => p.module))];
          allModules.forEach((mod, i) => {
            dynamicModuleMap[mod] = {
              label: mod,
              color: moduleColors[i % moduleColors.length],
            };
          });

          const moduleCol = this.columns.find((c) => c.key === 'module');
          if (moduleCol) {
            moduleCol.statusMap = dynamicModuleMap;
          }
        },
        error: () => {
          this.permissions.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar permisos', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private loadModules(): void {
    this.permissionService
      .getModules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.availableModules.set(res.data ?? []);
        },
      });
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadPermissions();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadPermissions();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadPermissions();
  }

  protected onModuleFilterChange(module: string): void {
    this.moduleFilter.set(module);
    this.currentPage.set(0);
    this.loadPermissions();
  }

  protected onRowAction(event: RowAction<Permission>): void {
    switch (event.action) {
      case 'edit':
        this.openFormDialog(event.row);
        break;
      case 'delete':
        this.confirmDelete(event.row);
        break;
    }
  }

  protected onAdd(): void {
    this.openFormDialog();
  }

  private openFormDialog(permission?: Permission): void {
    const dialogRef = this.dialog.open<
      PermissionFormComponent,
      { permission?: Permission },
      boolean
    >(PermissionFormComponent, {
      width: '520px',
      disableClose: true,
      autoFocus: false,
      data: { permission },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadPermissions();
        }
      });
  }

  private confirmDelete(permission: Permission): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar Permiso',
        message: `¿Está seguro de eliminar el permiso "${permission.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deletePermission(permission.id);
        }
      });
  }

  private deletePermission(id: number): void {
    this.permissionService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Permiso eliminado correctamente', 'Cerrar', { duration: 3000 });
          this.loadPermissions();
        },
        error: () => {
          this.snackBar.open('Error al eliminar permiso', 'Cerrar', { duration: 5000 });
        },
      });
  }
}
