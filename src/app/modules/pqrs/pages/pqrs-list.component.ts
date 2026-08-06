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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { PqrsService } from '../pqrs.service';
import { PQRS, PqrsStatus, PqrsType } from '../../../core/models/pqrs.interface';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
} from '../../../shared/components/data-table/data-table.types';
import { PqrsDetailComponent } from '../components/pqrs-detail.component';
import { PqrsFormComponent } from '../components/pqrs-form.component';

const STATUS_COLORS: Record<PqrsStatus, string> = {
  PENDIENTE: '#f59e0b',
  EN_PROCESO: '#3b82f6',
  RESPONDIDO: '#10b981',
  CERRADO: '#6b7280',
  RECHAZADO: '#ef4444',
};

const TYPE_LABELS: Record<PqrsType, string> = {
  QUEJA: 'Queja',
  PETICION: 'Petición',
  RECLAMO: 'Reclamo',
  SUGERENCIA: 'Sugerencia',
};

@Component({
  selector: 'app-pqrs-list',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pqrs-list.component.html',
  styleUrls: ['./pqrs-list.component.scss'],
})
export class PqrsListComponent implements OnInit {
  private readonly pqrsService = inject(PqrsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pqrsList = signal<PQRS[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('createdAt');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');
  protected readonly statusFilter = signal('');
  protected readonly typeFilter = signal('');
  protected readonly dateFrom = signal<Date | null>(null);
  protected readonly dateTo = signal<Date | null>(null);

  protected readonly statusList = Object.entries(STATUS_COLORS).map(([value, color]) => ({
    value: value as PqrsStatus,
    label: value.replace('_', ' '),
    color,
  }));

  protected readonly typeList = Object.entries(TYPE_LABELS).map(([value, label]) => ({
    value: value as PqrsType,
    label,
  }));

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      type: 'status',
      width: '120px',
      align: 'center',
      statusMap: {
        QUEJA: { label: 'Queja', color: '#ef4444' },
        PETICION: { label: 'Petición', color: '#3b82f6' },
        RECLAMO: { label: 'Reclamo', color: '#f59e0b' },
        SUGERENCIA: { label: 'Sugerencia', color: '#10b981' },
      },
    },
    { key: 'subject', label: 'Asunto', sortable: true },
    { key: 'userName', label: 'Usuario', sortable: true, width: '140px' },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      type: 'status',
      width: '130px',
      align: 'center',
      statusMap: {
        PENDIENTE: { label: 'Pendiente', color: '#f59e0b' },
        EN_PROCESO: { label: 'En Proceso', color: '#3b82f6' },
        RESPONDIDO: { label: 'Respondido', color: '#10b981' },
        CERRADO: { label: 'Cerrado', color: '#6b7280' },
        RECHAZADO: { label: 'Rechazado', color: '#ef4444' },
      },
    },
    { key: 'assignedToName', label: 'Asignado a', sortable: true, width: '140px' },
    { key: 'createdAt', label: 'Fecha', sortable: true, type: 'date', width: '120px', format: 'dd/MM/yyyy HH:mm' },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  ngOnInit(): void {
    this.loadPqrs();
  }

  protected hasActiveFilters(): boolean {
    return !!(this.statusFilter() || this.typeFilter() || this.dateFrom() || this.dateTo());
  }

  protected loadPqrs(): void {
    this.loading.set(true);

    const filters: Record<string, unknown> = {};
    if (this.statusFilter()) filters['status'] = this.statusFilter();
    if (this.typeFilter()) filters['type'] = this.typeFilter();
    if (this.dateFrom()) filters['dateFrom'] = this.formatDate(this.dateFrom()!);
    if (this.dateTo()) filters['dateTo'] = this.formatDate(this.dateTo()!);

    this.pqrsService
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
          this.pqrsList.set(res.items);
          this.totalItems.set(res.total);
        },
        error: () => {
          this.snackBar.open('Error al cargar PQRS', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadPqrs();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadPqrs();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadPqrs();
  }

  protected onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(0);
    this.loadPqrs();
  }

  protected onTypeFilterChange(type: string): void {
    this.typeFilter.set(type);
    this.currentPage.set(0);
    this.loadPqrs();
  }

  protected onDateFromChange(date: Date | null): void {
    this.dateFrom.set(date);
    this.currentPage.set(0);
    this.loadPqrs();
  }

  protected onDateToChange(date: Date | null): void {
    this.dateTo.set(date);
    this.currentPage.set(0);
    this.loadPqrs();
  }

  protected clearFilters(): void {
    this.statusFilter.set('');
    this.typeFilter.set('');
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.currentPage.set(0);
    this.loadPqrs();
  }

  protected onRowAction(event: RowAction<PQRS>): void {
    switch (event.action) {
      case 'view':
        this.openDetail(event.row);
        break;
      case 'edit':
        this.openDetail(event.row);
        break;
      case 'delete':
        this.confirmDelete(event.row);
        break;
    }
  }

  protected onAdd(): void {
    this.openFormDialog();
  }

  protected openDetail(pqrs: PQRS): void {
    const dialogRef = this.dialog.open<PqrsDetailComponent, { pqrsId: number }, boolean>(
      PqrsDetailComponent,
      {
        width: '800px',
        maxHeight: '90vh',
        disableClose: false,
        autoFocus: false,
        data: { pqrsId: pqrs.id },
      },
    );

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((refresh) => {
        if (refresh) this.loadPqrs();
      });
  }

  private openFormDialog(): void {
    const dialogRef = this.dialog.open<PqrsFormComponent, Record<string, never>, boolean>(
      PqrsFormComponent,
      {
        width: '520px',
        disableClose: true,
        autoFocus: false,
        data: {},
      },
    );

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) this.loadPqrs();
      });
  }

  private confirmDelete(pqrs: PQRS): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar PQRS',
        message: `¿Está seguro de eliminar el PQRS "${pqrs.subject}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deletePqrs(pqrs.id);
        }
      });
  }

  private deletePqrs(id: number): void {
    this.pqrsService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('PQRS eliminado correctamente', 'Cerrar', { duration: 3000 });
          this.loadPqrs();
        },
        error: () => {
          this.snackBar.open('Error al eliminar PQRS', 'Cerrar', { duration: 5000 });
        },
      });
  }
}
