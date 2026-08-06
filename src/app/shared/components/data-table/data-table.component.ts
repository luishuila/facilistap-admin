import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent as MatPageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort, Sort as MatSortEvent } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TableColumn, SortEvent, PageEvent, RowAction, ExportEvent } from './data-table.types';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="data-table-container">
      @if (titleConfig.title || titleConfig.showSearch || titleConfig.showExport || titleConfig.showAddButton) {
        <div class="table-toolbar">
          <div class="toolbar-left">
            @if (titleConfig.title) {
              <h2 class="table-title">{{ titleConfig.title }}</h2>
            }
          </div>
          <div class="toolbar-right">
            @if (titleConfig.showSearch) {
              <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
                <mat-icon matPrefix>search</mat-icon>
                <input
                  matInput
                  [placeholder]="titleConfig.searchPlaceholder"
                  [ngModel]="titleConfig.searchTerm"
                  (ngModelChange)="onSearchChange($event)"
                />
                @if (titleConfig.searchTerm) {
                  <button matSuffix mat-icon-button aria-label="Clear" (click)="clearSearch()">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>
            }
            @if (titleConfig.showExport) {
              <button mat-stroked-button [matMenuTriggerFor]="exportMenu" class="export-btn">
                <mat-icon>file_download</mat-icon>
                <span>Exportar</span>
              </button>
              <mat-menu #exportMenu="matMenu">
                @for (format of titleConfig.exportFormats; track format) {
                  <button mat-menu-item (click)="onExport(format)">
                    <mat-icon>
                      @if (format === 'excel') { table_view }
                      @else if (format === 'pdf') { picture_as_pdf }
                      @else { description }
                    </mat-icon>
                    <span>{{ format === 'excel' ? 'Excel' : format === 'pdf' ? 'PDF' : 'CSV' }}</span>
                  </button>
                }
              </mat-menu>
            }
            @if (titleConfig.showAddButton) {
              <button mat-flat-button color="primary" class="add-btn" (click)="onAdd()">
                <mat-icon>add</mat-icon>
                <span>{{ titleConfig.addButtonLabel }}</span>
              </button>
            }
          </div>
        </div>
      }

      @if (titleConfig.loading) {
        <mat-progress-bar mode="indeterminate" color="primary"></mat-progress-bar>
      }

      <div class="table-wrapper" [class.loading-overlay]="titleConfig.loading">
        <table
          mat-table
          [dataSource]="dataSource"
          matSort
          [matSortActive]="titleConfig.sortActive"
          [matSortDirection]="titleConfig.sortDirection"
          (matSortChange)="onSortChange($event)"
          class="mat-elevation-z0 data-table"
        >
          @for (column of visibleColumns(); track column.key) {
            <ng-container [matColumnDef]="column.key">
              <th mat-header-cell *matHeaderCellDef [style.width]="column.width || 'auto'"
                [style.text-align]="column.align || 'left'"
                [mat-sort-header]="column.sortable ? column.key : null"
                [disabled]="!column.sortable">
                {{ column.label }}
              </th>
              <td mat-cell *matCellDef="let row; let i = index" [style.text-align]="column.align || 'left'">
                @if (column.type === 'status') {
                  <mat-chip
                    class="status-chip"
                    [style.background]="getStatusColor(row[column.key], column)"
                    [style.color]="'#fff'"
                    [style.font-size.px]="12"
                  >
                    {{ getStatusLabel(row[column.key], column) }}
                  </mat-chip>
                } @else if (column.type === 'boolean') {
                  <mat-icon
                    [style.color]="row[column.key] ? '#22c55e' : '#ef4444'"
                    [style.font-size.px]="20"
                  >
                    {{ row[column.key] ? 'check_circle' : 'cancel' }}
                  </mat-icon>
                } @else if (column.type === 'date') {
                  {{ row[column.key] | date: (column.format || 'dd/MM/yyyy') }}
                } @else if (column.type === 'actions') {
                  <div class="actions-cell">
                    <button mat-icon-button [matMenuTriggerFor]="rowMenu" [matTooltip]="'Acciones'">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #rowMenu="matMenu">
                      <button mat-menu-item (click)="onRowAction('edit', row)">
                        <mat-icon>edit</mat-icon>
                        <span>Editar</span>
                      </button>
                      <button mat-menu-item (click)="onRowAction('view', row)">
                        <mat-icon>visibility</mat-icon>
                        <span>Ver</span>
                      </button>
                      <button mat-menu-item (click)="onRowAction('toggle', row)">
                        <mat-icon>toggle_on</mat-icon>
                        <span>Activar/Desactivar</span>
                      </button>
                      <mat-divider></mat-divider>
                      <button mat-menu-item class="danger-action" (click)="onRowAction('delete', row)">
                        <mat-icon color="warn">delete</mat-icon>
                        <span>Eliminar</span>
                      </button>
                    </mat-menu>
                  </div>
                } @else if (column.type === 'number') {
                  {{ row[column.key] | number: (column.format || '1.0-0') }}
                } @else {
                  {{ row[column.key] }}
                }
              </td>
            </ng-container>
          }

          <tr mat-header-row *matHeaderRowDef="displayedColumns(); sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>

          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell no-data-cell" [attr.colspan]="displayedColumns().length">
              <div class="empty-state">
                <mat-icon class="empty-icon">inbox</mat-icon>
                <span class="empty-title">Sin datos</span>
                <span class="empty-message">No se encontraron resultados</span>
              </div>
            </td>
          </tr>
        </table>
      </div>

      @if (titleConfig.totalItems > 0) {
        <mat-paginator
          [length]="titleConfig.totalItems"
          [pageSize]="titleConfig.pageSize"
          [pageSizeOptions]="titleConfig.pageSizeOptions"
          [pageIndex]="titleConfig.currentPage"
          (page)="onPageChange($event)"
          showFirstLastButtons
          class="table-paginator"
        ></mat-paginator>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .data-table-container {
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .table-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        flex-wrap: wrap;
        gap: 12px;
      }

      .toolbar-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .table-title {
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
        white-space: nowrap;
      }

      .toolbar-right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .search-field {
        width: 280px;

        ::ng-deep .mat-mdc-form-field-flex {
          border-radius: 8px;
        }

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
          display: none;
        }
      }

      .export-btn {
        border-radius: 8px;
        font-weight: 500;
      }

      .add-btn {
        border-radius: 8px;
        font-weight: 500;
      }

      .table-wrapper {
        position: relative;
        overflow: auto;
        min-height: 200px;
      }

      .loading-spinner-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 5;
      }

      .data-table {
        width: 100%;
        white-space: nowrap;

        .mat-mdc-header-cell {
          background: #f8fafc;
          color: #475569;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 16px;
          border-bottom: 2px solid #e2e8f0;
        }

        .mat-mdc-cell {
          padding: 14px 16px;
          font-size: 14px;
          color: #334155;
          border-bottom: 1px solid #f1f5f9;
        }

        .mat-mdc-row:hover {
          background: #f8fafc;
        }
      }

      .status-chip {
        font-weight: 600;
        height: 24px;
        line-height: 24px;
        padding: 0 12px;
        border-radius: 12px;
      }

      .actions-cell {
        display: flex;
        justify-content: center;
      }

      .danger-action {
        ::ng-deep .mat-mdc-menu-item-text {
          color: #ef4444;
        }
      }

      .no-data-cell {
        text-align: center;
        padding: 48px 16px;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #94a3b8;

        .empty-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
        }

        .empty-title {
          font-size: 16px;
          font-weight: 600;
          color: #64748b;
        }

        .empty-message {
          font-size: 14px;
        }
      }

      .table-paginator {
        border-top: 1px solid #f1f5f9;
        background: #ffffff;
      }
    `,
  ],
})
export class DataTableComponent<T> implements OnInit, OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() data: T[] = [];
  @Input() totalItems = 0;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];
  @Input() loading = false;
  @Input() showSearch = true;
  @Input() searchPlaceholder = 'Buscar...';
  @Input() showExport = true;
  @Input() exportFormats: ('excel' | 'pdf' | 'csv')[] = ['excel', 'pdf'];
  @Input() title = '';
  @Input() showAddButton = true;
  @Input() addButtonLabel = 'Agregar';

  @Output() sortChange = new EventEmitter<SortEvent>();
  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() rowAction = new EventEmitter<RowAction<T>>();
  @Output() add = new EventEmitter<void>();
  @Output() export = new EventEmitter<ExportEvent>();

  protected readonly dataSource = new MatTableDataSource<T>([]);

  protected readonly titleConfig = signal({
    title: '',
    showSearch: true,
    searchPlaceholder: 'Buscar...',
    searchTerm: '',
    showExport: true,
    exportFormats: ['excel', 'pdf'] as ('excel' | 'pdf' | 'csv')[],
    showAddButton: true,
    addButtonLabel: 'Agregar',
    loading: false,
    totalItems: 0,
    pageSize: 10,
    pageSizeOptions: [5, 10, 25, 50] as number[],
    currentPage: 0,
    sortActive: '',
    sortDirection: '' as 'asc' | 'desc' | '',
  });

  private readonly searchSubject = new Subject<string>();
  private readonly searchDebounceMs = 300;

  constructor() {
    this.searchSubject
      .pipe(debounceTime(this.searchDebounceMs), distinctUntilChanged())
      .subscribe((term) => {
        this.searchChange.emit(term);
      });
  }

  ngOnInit(): void {
    this.syncInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.dataSource.data = this.data;
    }
    this.syncInputs();
  }

  private syncInputs(): void {
    this.titleConfig.update((c) => ({
      ...c,
      title: this.title,
      showSearch: this.showSearch,
      searchPlaceholder: this.searchPlaceholder,
      showExport: this.showExport,
      exportFormats: this.exportFormats,
      showAddButton: this.showAddButton,
      addButtonLabel: this.addButtonLabel,
      loading: this.loading,
      totalItems: this.totalItems,
      pageSize: this.pageSize,
      pageSizeOptions: this.pageSizeOptions,
      currentPage: this.currentPageIndex(),
      sortActive: this.sortActive(),
      sortDirection: this.sortDirection(),
    }));
    this.dataSource.data = this.data;
  }

  private readonly _sortActive = signal('');
  private readonly _sortDirection = signal<'asc' | 'desc' | ''>('');
  private readonly _currentPage = signal(0);

  protected sortActive(): string {
    return this._sortActive();
  }

  protected sortDirection(): 'asc' | 'desc' | '' {
    return this._sortDirection();
  }

  protected currentPageIndex(): number {
    return this._currentPage();
  }

  protected visibleColumns(): TableColumn[] {
    return this.columns.filter((c) => c.visible !== false);
  }

  protected displayedColumns(): string[] {
    return this.visibleColumns().map((c) => c.key);
  }

  protected getStatusColor(value: string, column: TableColumn): string {
    if (column.statusMap && column.statusMap[value]) {
      return column.statusMap[value].color;
    }
    const defaultColors: Record<string, string> = {
      active: '#22c55e',
      activo: '#22c55e',
      inactive: '#94a3b8',
      inactivo: '#94a3b8',
      blocked: '#ef4444',
      bloqueado: '#ef4444',
      pending: '#f59e0b',
      pendiente: '#f59e0b',
      completed: '#3b82f6',
      completado: '#3b82f6',
      open: '#3b82f6',
      abierto: '#3b82f6',
      closed: '#64748b',
      cerrado: '#64748b',
      in_progress: '#8b5cf6',
      en_progreso: '#8b5cf6',
    };
    return defaultColors[value?.toLowerCase()] || '#94a3b8';
  }

  protected getStatusLabel(value: string, column: TableColumn): string {
    if (column.statusMap && column.statusMap[value]) {
      return column.statusMap[value].label;
    }
    return value || 'N/A';
  }

  protected onSortChange(event: MatSortEvent): void {
    this._sortActive.set(event.active);
    this._sortDirection.set(event.direction);
    this.sortChange.emit({ active: event.active, direction: event.direction });
  }

  protected onPageChange(event: MatPageEvent): void {
    this._currentPage.set(event.pageIndex);
    this.pageChange.emit({ pageIndex: event.pageIndex, pageSize: event.pageSize });
  }

  protected onSearchChange(term: string): void {
    this.titleConfig.update((c) => ({ ...c, searchTerm: term }));
    this.searchSubject.next(term.trim());
  }

  protected clearSearch(): void {
    this.titleConfig.update((c) => ({ ...c, searchTerm: '' }));
    this.searchSubject.next('');
  }

  protected onRowAction(action: string, row: T): void {
    this.rowAction.emit({ action, row });
  }

  protected onAdd(): void {
    this.add.emit();
  }

  protected onExport(format: 'excel' | 'pdf' | 'csv'): void {
    this.export.emit({ format });
  }
}
