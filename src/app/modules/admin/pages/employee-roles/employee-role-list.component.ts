import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageEvent, RowAction, RowActionOption, TableColumn } from '../../../../shared/components/data-table/data-table.types';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import {
  EmployeeRoleCatalog,
  EmployeeRoleRow,
  EmployeeRoleService,
  EmployeeRoleType,
} from '../../services/employee-role.service';
import { EmployeeRoleFormComponent, EmployeeRoleFormData } from './employee-role-form.component';
import { EmployeeRoleTypeFormComponent } from './employee-role-type-form.component';

type Row = EmployeeRoleRow & { roleLabel: string; permissionsLabel: string; state: string };
type TypeRow = EmployeeRoleType & { functions: string; permsLabel: string; state: string; kind: string };

@Component({
  selector: 'app-employee-role-list',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, MatTabsModule, MatButtonModule, MatIconModule, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Roles de empleados</h1>
          <p class="page-subtitle">
            Cree roles (ej. Recepcionista) con sus funciones y permisos: el dueño del negocio los elige en la app
            al agregar un empleado. También puede asignarlos aquí.
          </p>
        </div>
        @if (tab() === 0) {
          <button mat-flat-button color="primary" class="add-btn" (click)="openTypeForm()">
            <mat-icon>add_moderator</mat-icon>
            <span>Crear rol</span>
          </button>
        }
      </div>

      <mat-tab-group [selectedIndex]="tab()" (selectedIndexChange)="tab.set($event)" animationDuration="150ms">
        <mat-tab label="Roles">
          <div class="tab-body">
            <app-data-table
              [columns]="typeColumns"
              [data]="typeRows()"
              [totalItems]="typeRows().length"
              [pageSize]="50"
              [loading]="loadingTypes()"
              [showSearch]="false"
              [showExport]="false"
              [showAddButton]="false"
              [rowActions]="typeActions"
              (rowAction)="onTypeAction($event)"
            />
          </div>
        </mat-tab>
        <mat-tab label="Asignación">
          <div class="tab-body">
            <app-data-table
              [columns]="columns"
              [data]="pageRows()"
              [totalItems]="filtered().length"
              [pageSize]="pageSize()"
              [loading]="loading()"
              [showSearch]="true"
              [searchPlaceholder]="'Buscar por persona, email o empresa...'"
              [showExport]="false"
              [showAddButton]="false"
              [rowActions]="rowActions"
              (pageChange)="onPage($event)"
              (searchChange)="search.set($event); page.set(0)"
              (rowAction)="onAction($event)"
            />
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
      .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 820px; }
      .add-btn { border-radius: 12px; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; }
      .tab-body { padding-top: 16px; }
    `,
  ],
})
export class EmployeeRoleListComponent implements OnInit {
  private readonly service = inject(EmployeeRoleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tab = signal(0);

  // ─── Roles (catalogo) ───
  protected readonly typeActions: RowActionOption[] = [
    { action: 'edit', label: 'Editar / permisos', icon: 'tune' },
    { action: 'toggle', label: 'Activar / desactivar', icon: 'toggle_on' },
    { action: 'delete', label: 'Eliminar', icon: 'delete', danger: true },
  ];
  protected readonly typeColumns: TableColumn[] = [
    { key: 'name', label: 'Rol' },
    { key: 'functions', label: 'Funciones' },
    { key: 'permsLabel', label: 'Permisos' },
    { key: 'employeesCount', label: 'Empleados', type: 'number', width: '110px', align: 'center' },
    {
      key: 'kind', label: 'Tipo', type: 'status', width: '120px', align: 'center',
      statusMap: { SYSTEM: { label: 'Sistema', color: '#64748b' }, CUSTOM: { label: 'Creado', color: '#0078ff' } },
    },
    {
      key: 'state', label: 'Estado', type: 'status', width: '110px', align: 'center',
      statusMap: { ON: { label: 'Activo', color: '#22c55e' }, OFF: { label: 'Inactivo', color: '#94a3b8' } },
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];
  protected readonly types = signal<EmployeeRoleType[]>([]);
  protected readonly loadingTypes = signal(false);
  protected readonly typeRows = computed<TypeRow[]>(() => this.types().map((t) => this.toTypeRow(t)));

  // ─── Asignacion ───
  protected readonly rowActions: RowActionOption[] = [{ action: 'roles', label: 'Cambiar rol', icon: 'assignment_ind' }];
  protected readonly columns: TableColumn[] = [
    { key: 'userFullName', label: 'Persona' },
    { key: 'email', label: 'Email' },
    { key: 'providerName', label: 'Empresa' },
    { key: 'roleLabel', label: 'Rol' },
    { key: 'permissionsLabel', label: 'Permisos' },
    {
      key: 'state', label: 'Estado', type: 'status', width: '110px', align: 'center',
      statusMap: { ON: { label: 'Activo', color: '#22c55e' }, OFF: { label: 'Inactivo', color: '#94a3b8' } },
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  private catalog: EmployeeRoleCatalog = { roles: [], permissions: [] };
  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return term
      ? this.rows().filter((r) => [r.userFullName, r.email, r.providerName, r.roleLabel].some((v) => (v ?? '').toLowerCase().includes(term)))
      : this.rows();
  });
  protected readonly pageRows = computed(() =>
    this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()),
  );

  ngOnInit(): void {
    this.service
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          this.catalog = c;
          this.loadTypes();
          this.load();
        },
        error: () => {
          this.loadTypes();
          this.load();
        },
      });
  }

  private loadTypes(): void {
    this.loadingTypes.set(true);
    this.service
      .listTypes()
      .pipe(
        finalize(() => this.loadingTypes.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (t) => this.types.set(t),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar los roles', 'Cerrar', { duration: 5000 }),
      });
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
        next: (list) => this.rows.set(list.map((r) => this.toRow(r))),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar los empleados', 'Cerrar', { duration: 5000 }),
      });
  }

  private permLabels(perms: Record<string, boolean> | null | undefined): string {
    const granted = this.catalog.permissions.filter((p) => perms?.[p.key]).map((p) => p.label);
    return granted.length ? granted.join(', ') : 'Ninguno';
  }

  private toTypeRow(t: EmployeeRoleType): TypeRow {
    const functions = [t.attendsServices ? 'Atiende servicios' : null, t.managesAgenda ? 'Gestiona agenda' : null]
      .filter(Boolean)
      .join(' + ');
    return {
      ...t,
      functions,
      permsLabel: t.managesAgenda ? this.permLabels(t.permissions) : '—',
      kind: t.isSystem ? 'SYSTEM' : 'CUSTOM',
      state: t.isActive ? 'ON' : 'OFF',
    };
  }

  private toRow(r: EmployeeRoleRow): Row {
    const baseLabel = (code: string) => this.catalog.roles.find((x) => x.code === code)?.label ?? code;
    return {
      ...r,
      roleLabel: r.roleTypeName ?? (r.roles.length ? r.roles.map(baseLabel).join(' + ') : 'Sin rol'),
      permissionsLabel: r.roles.includes('ASSISTANT') ? this.permLabels(r.assistantPermissions) : '—',
      state: r.isActive ? 'ON' : 'OFF',
    };
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  // ─── Acciones: roles ───
  protected openTypeForm(type?: EmployeeRoleType): void {
    this.dialog
      .open<EmployeeRoleTypeFormComponent, EmployeeRoleType | undefined, boolean>(EmployeeRoleTypeFormComponent, {
        width: '740px',
        maxWidth: '95vw',
        autoFocus: false,
        disableClose: true,
        data: type,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.loadTypes();
        this.load();
      });
  }

  protected onTypeAction(e: RowAction<TypeRow>): void {
    if (e.action === 'edit') this.openTypeForm(e.row);
    else if (e.action === 'toggle') this.toggleType(e.row);
    else if (e.action === 'delete') this.confirmDeleteType(e.row);
  }

  private toggleType(t: TypeRow): void {
    const activate = !t.isActive;
    this.service
      .updateType(t.id, { isActive: activate })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            activate ? `${t.name} activado: se muestra en la app` : `${t.name} desactivado: ya no se ofrece en la app`,
            'Cerrar',
            { duration: 3500 },
          );
          this.loadTypes();
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo cambiar el estado', 'Cerrar', { duration: 5000 }),
      });
  }

  private confirmDeleteType(t: TypeRow): void {
    if (t.isSystem) {
      this.snackBar.open('Empleado y Asistente son roles del sistema: no se eliminan (puede desactivarlos).', 'Cerrar', { duration: 5000 });
      return;
    }
    this.confirmDialog
      .confirm({
        title: 'Eliminar rol',
        message: t.employeesCount
          ? `${t.employeesCount} empleado(s) tienen "${t.name}". Conservarán sus funciones y permisos actuales, pero sin este rol.`
          : `Se eliminará el rol "${t.name}".`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.service
          .removeType(t.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Rol eliminado', 'Cerrar', { duration: 3000 });
              this.loadTypes();
              this.load();
            },
            error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo eliminar', 'Cerrar', { duration: 5000 }),
          });
      });
  }

  // ─── Acciones: asignacion ───
  protected onAction(e: RowAction<Row>): void {
    if (e.action !== 'roles') return;
    this.dialog
      .open<EmployeeRoleFormComponent, EmployeeRoleFormData, boolean>(EmployeeRoleFormComponent, {
        width: '600px',
        maxWidth: '95vw',
        autoFocus: false,
        data: { row: e.row, types: this.types().filter((t) => t.isActive || t.id === e.row.roleTypeId) },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.load();
        this.loadTypes();
      });
  }
}
