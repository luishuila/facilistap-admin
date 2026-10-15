import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Observable, finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageEvent, RowAction, RowActionOption, TableColumn } from '../../../../shared/components/data-table/data-table.types';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { translationsLabel } from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import { MaestraGroup, MaestraItem, MaestraService, metadataValue } from '../../services/maestra.service';
import { MaestraFormComponent, MaestraFormData } from './maestra-form.component';

type Row = MaestraItem & { translations: string; state: string; value: string };

@Component({
  selector: 'app-maestra-list',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    DataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Tabla maestra</h1>
          <p class="page-subtitle">
            Catálogos de la app (tipos de documento, géneros, motivos de PQRS, tipos de contrato...) con su nombre en cada idioma.
          </p>
        </div>
        <button mat-flat-button color="primary" class="add-btn" (click)="openForm()">
          <mat-icon>add</mat-icon>
          <span>Nuevo valor</span>
        </button>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Grupo</mat-label>
          <mat-select [value]="group()" (selectionChange)="group.set($event.value); page.set(0)">
            <mat-option [value]="null">Todos los grupos</mat-option>
            @for (g of groups(); track g.code) {
              <mat-option [value]="g.code">{{ g.label }} ({{ countOf(g.code) }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <span class="total">{{ filtered().length }} valores</span>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="pageRows()"
        [totalItems]="filtered().length"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por código o nombre...'"
        [showExport]="false"
        [showAddButton]="false"
        [rowActions]="rowActions"
        (pageChange)="onPage($event)"
        (searchChange)="search.set($event); page.set(0)"
        (rowAction)="onAction($event)"
      />
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
      .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 760px; }
      .add-btn { border-radius: 12px; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; }
      .filters { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
        mat-form-field { min-width: 280px; } }
      .total { font-size: 14px; color: var(--fac-text-muted); }
    `,
  ],
})
export class MaestraListComponent implements OnInit {
  private readonly service = inject(MaestraService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rowActions: RowActionOption[] = [
    { action: 'edit', label: 'Editar', icon: 'edit' },
    { action: 'toggle', label: 'Activar / desactivar', icon: 'toggle_on' },
    { action: 'delete', label: 'Eliminar', icon: 'delete', danger: true },
  ];

  protected readonly columns: TableColumn[] = [
    { key: 'groupLabel', label: 'Grupo' },
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'value', label: 'Valor', width: '160px' },
    { key: 'translations', label: 'Idiomas', width: '150px' },
    { key: 'sortOrder', label: 'Orden', type: 'number', width: '80px', align: 'center' },
    {
      key: 'state', label: 'Estado', type: 'status', width: '110px', align: 'center',
      statusMap: { ON: { label: 'Activo', color: '#22c55e' }, OFF: { label: 'Inactivo', color: '#94a3b8' } },
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  protected readonly groups = signal<MaestraGroup[]>([]);
  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(false);
  protected readonly group = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly filtered = computed(() => {
    const g = this.group();
    const term = this.search().trim().toLowerCase();
    return this.rows().filter(
      (r) =>
        (!g || r.groupName === g) &&
        (!term || [r.code, r.name, ...Object.values(r.localizedName ?? {})].some((v) => (v ?? '').toLowerCase().includes(term))),
    );
  });
  protected readonly pageRows = computed(() =>
    this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()),
  );

  ngOnInit(): void {
    this.service
      .groups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((g) => this.groups.set(g));
    this.load();
  }

  protected countOf(code: string): number {
    return this.rows().filter((r) => r.groupName === code).length;
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .list()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) =>
          this.rows.set(
            list.map((m) => ({
              ...m,
              translations: translationsLabel(m.localizedName),
              state: m.isActive ? 'ON' : 'OFF',
              value: metadataValue(m.metadata) ?? '',
            })),
          ),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar la tabla maestra', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  protected onAction(e: RowAction<Row>): void {
    if (e.action === 'edit') this.openForm(e.row);
    else if (e.action === 'toggle') this.toggle(e.row);
    else if (e.action === 'delete') this.confirmDelete(e.row);
  }

  protected openForm(item?: MaestraItem): void {
    this.dialog
      .open<MaestraFormComponent, MaestraFormData, boolean>(MaestraFormComponent, {
        width: '740px',
        maxWidth: '95vw',
        autoFocus: false,
        disableClose: true,
        data: { item, groups: this.groups(), groupName: this.group() },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.load());
  }

  private toggle(row: Row): void {
    const activate = !row.isActive;
    this.run(
      this.service.update(row.id, { isActive: activate }),
      activate ? `${row.name} activado` : `${row.name} desactivado (ya no se muestra en la app)`,
    );
  }

  private confirmDelete(row: Row): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar valor',
        message: `Se eliminará "${row.name}" (${row.code}) de ${row.groupLabel}. Si está en uso no se podrá eliminar: desactívelo en su lugar.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.run(this.service.remove(row.id), 'Valor eliminado'));
  }

  private run(request$: Observable<unknown>, done: string): void {
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(done, 'Cerrar', { duration: 3000 });
        this.load();
      },
      error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo completar la acción', 'Cerrar', { duration: 5000 }),
    });
  }
}
