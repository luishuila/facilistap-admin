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
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { ProviderService } from '../../services/provider.service';
import { Provider } from '../../../../core/models/provider.interface';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
  RowActionOption,
} from '../../../../shared/components/data-table/data-table.types';
import { ProviderFormComponent } from './provider-form.component';

@Component({
  selector: 'app-provider-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatButtonModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './provider-list.component.html',
  styleUrls: ['./provider-list.component.scss'],
})
export class ProviderListComponent implements OnInit {
  private readonly providerService = inject(ProviderService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly providers = signal<Provider[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('name');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');

  /** Sin "Ver": el formulario de edición ya muestra todo. */
  protected readonly rowActions: RowActionOption[] = [
    { action: 'edit', label: 'Editar', icon: 'edit' },
    { action: 'toggle', label: 'Activar / desactivar', icon: 'toggle_on' },
    { action: 'delete', label: 'Eliminar', icon: 'delete', danger: true },
  ];

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'ownerName', label: 'Dueño', subKey: 'ownerUsername' },
    { key: 'username', label: 'Usuario', width: '140px' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono', width: '140px' },
    {
      key: 'isActive', label: 'Estado', type: 'status', width: '110px', align: 'center',
      statusMap: { true: { label: 'Activo', color: '#22c55e' }, false: { label: 'Inactivo', color: '#94a3b8' } },
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
    this.loadProviders();
  }

  protected loadProviders(): void {
    this.loading.set(true);

    this.providerService
      .getAll({
        page: this.currentPage() + 1,
        limit: this.pageSize(),
        search: this.searchTerm() || undefined,
        sortBy: this.sortActive(),
        sortOrder: this.sortDirection(),
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.providers.set(res?.items ?? []);
          this.totalItems.set(res?.total ?? 0);
        },
        error: () => {
          this.providers.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar proveedores', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadProviders();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProviders();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadProviders();
  }

  protected onRowAction(event: RowAction<Provider>): void {
    switch (event.action) {
      case 'edit':
        this.openFormDialog(event.row);
        break;
      case 'toggle':
        this.confirmToggle(event.row);
        break;
      case 'delete':
        this.confirmDelete(event.row);
        break;
    }
  }

  protected onAdd(): void {
    this.openFormDialog();
  }

  private openFormDialog(provider?: Provider): void {
    const dialogRef = this.dialog.open<
      ProviderFormComponent,
      { provider?: Provider },
      boolean
    >(ProviderFormComponent, {
      width: '560px',
      disableClose: true,
      autoFocus: false,
      data: { provider },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadProviders();
        }
      });
  }

  private confirmToggle(row: Provider): void {
    const activate = !row.isActive;
    this.confirmDialog
      .confirm({
        title: activate ? 'Activar proveedor' : 'Desactivar proveedor',
        message: activate
          ? `${row.name} volverá a estar disponible en la app.`
          : `${row.name} dejará de aparecer en las búsquedas y el inicio de la app (sus datos no se borran). Podrá activarlo de nuevo cuando quiera.`,
        confirmText: activate ? 'Activar' : 'Desactivar',
        cancelText: 'Cancelar',
        icon: activate ? 'toggle_on' : 'toggle_off',
        color: activate ? '#22c55e' : '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.providerService
          .setActive(row.id, activate)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open(activate ? 'Proveedor activado' : 'Proveedor desactivado', 'Cerrar', { duration: 3000 });
              this.loadProviders();
            },
            error: (err: Error) =>
              this.snackBar.open(err?.message || 'No se pudo cambiar el estado', 'Cerrar', { duration: 5000 }),
          });
      });
  }

  private confirmDelete(provider: Provider): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar Proveedor',
        message: `¿Está seguro de eliminar al proveedor "${provider.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteProvider(provider.id);
        }
      });
  }

  private deleteProvider(id: number): void {
    this.providerService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Proveedor eliminado correctamente', 'Cerrar', {
            duration: 3000,
          });
          this.loadProviders();
        },
        error: () => {
          this.snackBar.open('Error al eliminar proveedor', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }
}
