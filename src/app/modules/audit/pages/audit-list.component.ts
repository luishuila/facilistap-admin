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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AuditService } from '../audit.service';
import { Audit } from '../../../core/models/audit.interface';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
} from '../../../shared/components/data-table/data-table.types';
import { AuditDetailComponent } from '../components/audit-detail.component';

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#22c55e',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
  LOGIN: '#a855f7',
  LOGOUT: '#94a3b8',
  BLOCK: '#f97316',
  UNBLOCK: '#22c55e',
  PERMISSION_CHANGE: '#eab308',
  ROLE_CHANGE: '#eab308',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio Sesión',
  LOGOUT: 'Cierre Sesión',
  BLOCK: 'Bloqueo',
  UNBLOCK: 'Desbloqueo',
  PERMISSION_CHANGE: 'Cambio Permiso',
  ROLE_CHANGE: 'Cambio Rol',
};

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildActionStatusMap(): Record<string, { label: string; color: string }> {
  return Object.keys(ACTION_COLORS).reduce(
    (acc, key) => ({
      ...acc,
      [key]: { label: formatActionLabel(key), color: ACTION_COLORS[key] },
    }),
    {} as Record<string, { label: string; color: string }>
  );
}

@Component({
  selector: 'app-audit-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="audit-list-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Auditoría del Sistema</h1>
          <p class="page-subtitle">Registro de todas las acciones realizadas en el sistema</p>
        </div>
        <button mat-stroked-button class="export-btn" (click)="onExport()">
          <mat-icon>file_download</mat-icon>
          <span>Exportar</span>
        </button>
      </div>

      <div class="filters-card">
        <div class="filters-row">
          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Módulo</mat-label>
            <input matInput [formControl]="moduleFilter" placeholder="Filtrar por módulo" />
            <mat-icon matSuffix>folder</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Acción</mat-label>
            <mat-select [formControl]="actionFilter">
              <mat-option value="">Todas</mat-option>
              <mat-option value="CREATE">Creación</mat-option>
              <mat-option value="UPDATE">Actualización</mat-option>
              <mat-option value="DELETE">Eliminación</mat-option>
              <mat-option value="LOGIN">Inicio Sesión</mat-option>
              <mat-option value="LOGOUT">Cierre Sesión</mat-option>
              <mat-option value="BLOCK">Bloqueo</mat-option>
              <mat-option value="UNBLOCK">Desbloqueo</mat-option>
              <mat-option value="PERMISSION_CHANGE">Cambio Permiso</mat-option>
              <mat-option value="ROLE_CHANGE">Cambio Rol</mat-option>
            </mat-select>
            <mat-icon matSuffix>bolt</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
            <mat-label>Usuario</mat-label>
            <input matInput [formControl]="userFilter" placeholder="Buscar usuario" />
            <mat-icon matSuffix>person</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field date-field" subscriptSizing="dynamic">
            <mat-label>Rango de fechas</mat-label>
            <mat-date-range-input [formGroup]="dateRange" [rangePicker]="picker">
              <input matStartDate formControlName="start" placeholder="Desde" />
              <input matEndDate formControlName="end" placeholder="Hasta" />
            </mat-date-range-input>
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-date-range-picker #picker></mat-date-range-picker>
          </mat-form-field>

          <button mat-flat-button color="primary" class="apply-filters-btn" (click)="applyFilters()">
            <mat-icon>filter_list</mat-icon>
            <span>Filtrar</span>
          </button>

          <button mat-stroked-button class="clear-filters-btn" (click)="clearFilters()">
            <mat-icon>clear_all</mat-icon>
          </button>
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="auditEntries()"
        [totalItems]="totalItems()"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [showSearch]="false"
        [showExport]="false"
        [title]="''"
        [showAddButton]="false"
        (sortChange)="onSortChange($event)"
        (pageChange)="onPageChange($event)"
        (searchChange)="onSearchChange($event)"
        (rowAction)="onRowAction($event)"
      />

      @if (!loading() && auditEntries().length === 0) {
        <app-empty-state
          icon="history"
          title="Sin registros de auditoría"
          message="No se encontraron registros de auditoría con los filtros actuales"
        />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .audit-list-page {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 20px;
        gap: 16px;
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
        line-height: 1.2;
      }

      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: #94a3b8;
        font-weight: 400;
      }

      .export-btn {
        border-radius: 8px;
        font-weight: 500;
        height: 44px;
        padding: 0 20px;
        flex-shrink: 0;
      }

      .filters-card {
        background: #ffffff;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .filters-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        flex-wrap: wrap;
      }

      .filter-field {
        flex: 1;
        min-width: 180px;
      }

      .date-field {
        min-width: 280px;
      }

      .apply-filters-btn {
        border-radius: 8px;
        font-weight: 500;
        height: 56px;
        padding: 0 20px;
        flex-shrink: 0;
      }

      .clear-filters-btn {
        border-radius: 8px;
        font-weight: 500;
        height: 56px;
        padding: 0 12px;
        flex-shrink: 0;
        min-width: 56px;
      }

      ::ng-deep .filter-field .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    `,
  ],
})
export class AuditListComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly auditEntries = signal<Audit[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly sortActive = signal('createdAt');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');

  protected readonly moduleFilter = new FormControl<string>('');
  protected readonly actionFilter = new FormControl<string>('');
  protected readonly userFilter = new FormControl<string>('');
  protected readonly dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '70px' },
    { key: 'userName', label: 'Usuario', sortable: true },
    {
      key: 'action',
      label: 'Acción',
      sortable: true,
      type: 'status',
      width: '140px',
      align: 'center',
      statusMap: buildActionStatusMap(),
    },
    { key: 'module', label: 'Módulo', sortable: true },
    { key: 'description', label: 'Descripción' },
    { key: 'ipAddress', label: 'Dirección IP', width: '130px', align: 'center' },
    {
      key: 'createdAt',
      label: 'Fecha',
      sortable: true,
      type: 'date',
      format: 'dd/MM/yyyy HH:mm',
      width: '160px',
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  ngOnInit(): void {
    this.loadEntries();
  }

  protected loadEntries(): void {
    this.loading.set(true);

    const filters: Record<string, unknown> = {};
    const module = this.moduleFilter.value?.trim();
    const action = this.actionFilter.value;
    const user = this.userFilter.value?.trim();
    const start = this.dateRange.get('start')?.value;
    const end = this.dateRange.get('end')?.value;

    if (module) filters['module'] = module;
    if (action) filters['action'] = action;
    if (user) filters['user'] = user;
    if (start) filters['startDate'] = this.formatDate(start);
    if (end) filters['endDate'] = this.formatDate(end);

    this.auditService
      .getAll({
        page: this.currentPage() + 1,
        limit: this.pageSize(),
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
          this.auditEntries.set(res.items);
          this.totalItems.set(res.total);
        },
        error: () => {
          this.snackBar.open('Error al cargar registros de auditoría', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadEntries();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadEntries();
  }

  protected onSearchChange(_term: string): void {
    // search disabled via showSearch=false
  }

  protected onRowAction(event: RowAction<Audit>): void {
    if (event.action === 'view') {
      this.openDetailDialog(event.row.id);
    }
  }

  protected applyFilters(): void {
    this.currentPage.set(0);
    this.loadEntries();
  }

  protected clearFilters(): void {
    this.moduleFilter.reset('');
    this.actionFilter.reset('');
    this.userFilter.reset('');
    this.dateRange.reset();
    this.currentPage.set(0);
    this.loadEntries();
  }

  protected onExport(): void {
    const filters: Record<string, unknown> = {};
    const module = this.moduleFilter.value?.trim();
    const action = this.actionFilter.value;
    const user = this.userFilter.value?.trim();
    const start = this.dateRange.get('start')?.value;
    const end = this.dateRange.get('end')?.value;

    if (module) filters['module'] = module;
    if (action) filters['action'] = action;
    if (user) filters['user'] = user;
    if (start) filters['startDate'] = this.formatDate(start);
    if (end) filters['endDate'] = this.formatDate(end);

    this.auditService
      .export({
        page: 1,
        limit: 10000,
        sortBy: this.sortActive(),
        sortOrder: this.sortDirection(),
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`;
          anchor.click();
          window.URL.revokeObjectURL(url);
          this.snackBar.open('Exportación completada', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Error al exportar registros', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private openDetailDialog(auditId: number): void {
    this.dialog.open<AuditDetailComponent, { auditId: number }>(AuditDetailComponent, {
      width: '640px',
      maxHeight: '90vh',
      disableClose: false,
      autoFocus: false,
      data: { auditId },
    });
  }

  private formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
