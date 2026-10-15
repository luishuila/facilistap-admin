import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Observable, finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PanelModuleOption, StaffMember, StaffService } from '../../services/staff.service';
import { PageEvent, RowAction, RowActionOption, TableColumn } from '../../../../shared/components/data-table/data-table.types';
import { StaffFormComponent, StaffFormData } from './staff-form.component';

type StaffRow = StaffMember & { fullName: string; access: string; kind: string; state: string; lastLogin: string; session: string };

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, MatIconModule, MatButtonModule, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Administrativos</h1>
          <p class="page-subtitle">
            Cuentas del panel (separadas de los usuarios de la app) y a qué módulos puede entrar cada una.
            Solo el Super Administrador las crea y les da permisos.
          </p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="add-btn danger-btn" (click)="confirmLogoutAll()" [disabled]="!connectedOthers()">
            <mat-icon>logout</mat-icon>
            <span>Cerrar sesión a todos{{ connectedOthers() ? ' (' + connectedOthers() + ')' : '' }}</span>
          </button>
          <button mat-flat-button color="primary" class="add-btn" (click)="openForm()">
            <mat-icon>person_add</mat-icon>
            <span>Nuevo administrativo</span>
          </button>
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="pageRows()"
        [totalItems]="filtered().length"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por nombre o email...'"
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
      .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
      .header-left { display: flex; flex-direction: column; gap: 4px; max-width: 760px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 0; font-size: 14px; color: var(--fac-text-muted); }
      .add-btn { border-radius: 12px; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; }
      .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
      .danger-btn:not([disabled]) { color: #dc2626; border-color: #fca5a5; }
    `,
  ],
})
export class StaffListComponent implements OnInit {
  private readonly staffService = inject(StaffService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly selfId = this.auth.getCurrentUser()?.id ?? null;

  protected readonly rowActions: RowActionOption[] = [
    { action: 'edit', label: 'Editar / permisos', icon: 'tune' },
    { action: 'logout', label: 'Cerrar sesión (sacar del panel)', icon: 'logout' },
    { action: 'password', label: 'Restablecer contraseña', icon: 'lock_reset' },
    { action: 'toggle', label: 'Activar / desactivar', icon: 'toggle_on' },
    { action: 'delete', label: 'Eliminar administrativo', icon: 'delete', danger: true },
  ];

  protected readonly columns: TableColumn[] = [
    { key: 'fullName', label: 'Nombre' },
    { key: 'email', label: 'Email' },
    {
      key: 'kind', label: 'Tipo', type: 'status', width: '150px', align: 'center',
      statusMap: { SUPER: { label: 'Super Admin', color: '#0078ff' }, STAFF: { label: 'Administrativo', color: '#1daeff' } },
    },
    { key: 'access', label: 'Módulos permitidos' },
    {
      key: 'state', label: 'Estado', type: 'status', width: '130px', align: 'center',
      statusMap: {
        OK: { label: 'Activo', color: '#22c55e' },
        PENDING: { label: 'Clave temporal', color: '#f59e0b' },
        OFF: { label: 'Inactivo', color: '#ef4444' },
      },
    },
    {
      key: 'session', label: 'Sesión', type: 'status', width: '120px', align: 'center',
      statusMap: { ON: { label: 'Conectado', color: '#22c55e' }, OFF: { label: 'Sin sesión', color: '#94a3b8' } },
    },
    { key: 'lastLogin', label: 'Último acceso', width: '160px' },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  private modules: PanelModuleOption[] = [];
  protected readonly rows = signal<StaffRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return term ? this.rows().filter((r) => [r.fullName, r.email].some((v) => (v ?? '').toLowerCase().includes(term))) : this.rows();
  });
  /** Otros administrativos conectados ahora (para "Cerrar sesión a todos"). */
  protected readonly connectedOthers = computed(() => this.rows().filter((r) => r.id !== this.selfId && r.activeSessions > 0).length);

  protected readonly pageRows = computed(() =>
    this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()),
  );

  ngOnInit(): void {
    this.staffService
      .modules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (m) => {
          this.modules = m;
          this.load();
        },
        error: () => this.load(),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.staffService
      .list()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => this.rows.set(list.map((s) => this.toRow(s))),
        error: () => this.snackBar.open('Error al cargar los administrativos', 'Cerrar', { duration: 5000 }),
      });
  }

  private toRow(s: StaffMember): StaffRow {
    const label = (code: string) => this.modules.find((m) => m.code === code)?.label ?? code;
    const mods = s.modules ?? [];
    return {
      ...s,
      fullName: `${s.name ?? ''} ${s.lastname ?? ''}`.trim() + (s.id === this.selfId ? ' (usted)' : ''),
      kind: s.isSuperAdmin ? 'SUPER' : 'STAFF',
      state: !s.isActive ? 'OFF' : s.mustChangePassword ? 'PENDING' : 'OK',
      access: s.isSuperAdmin ? 'Todo el panel' : mods.length ? mods.map(label).join(', ') : 'Sin módulos (no puede entrar)',
      session: s.activeSessions > 0 ? 'ON' : 'OFF',
      lastLogin: s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca',
    };
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  protected onAction(e: RowAction<StaffRow>): void {
    const self = e.row.id === this.selfId;
    if (self && (e.action === 'toggle' || e.action === 'delete')) {
      this.snackBar.open('No puede desactivar ni eliminar su propia cuenta.', 'Cerrar', { duration: 4000 });
      return;
    }
    if (self && e.action === 'logout') {
      this.snackBar.open('Para cerrar su propia sesión use "Cerrar sesión" en el menú de usuario.', 'Cerrar', { duration: 4000 });
      return;
    }
    if (self && e.action === 'password') {
      this.snackBar.open('Para su propia cuenta use "Cambiar contraseña" en el menú de usuario.', 'Cerrar', { duration: 4000 });
      return;
    }
    if (e.action === 'edit') this.openForm(e.row);
    else if (e.action === 'logout') this.confirmLogout(e.row);
    else if (e.action === 'password') this.confirmReset(e.row);
    else if (e.action === 'toggle') this.confirmToggle(e.row);
    else if (e.action === 'delete') this.confirmDelete(e.row);
  }

  protected openForm(staff?: StaffMember): void {
    this.dialog
      .open<StaffFormComponent, StaffFormData, boolean>(StaffFormComponent, {
        width: '780px',
        maxWidth: '95vw',
        autoFocus: false,
        disableClose: true,
        data: { staff, selfId: this.selfId },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.load());
  }

  protected confirmLogoutAll(): void {
    this.ask(
      'Cerrar sesión a todos',
      `Se cerrará la sesión de ${this.connectedOthers()} administrativo(s) conectado(s) en todos sus equipos. Usted sigue dentro.`,
      'Cerrar sesión a todos',
      'logout',
      '#ef4444',
      () => this.staffService.closeAllSessions(),
      'Sesiones cerradas: saldrán del panel en menos de un minuto',
    );
  }

  private confirmLogout(row: StaffRow): void {
    this.ask(
      'Cerrar sesión',
      `${row.fullName} saldrá del panel en todos sus equipos (en menos de un minuto) y tendrá que volver a iniciar sesión.`,
      'Cerrar sesión',
      'logout',
      '#f59e0b',
      () => this.staffService.closeSessions(row.id),
      `Sesión de ${row.fullName} cerrada`,
    );
  }

  private confirmReset(row: StaffRow): void {
    const password = this.staffService.generatePassword();
    this.ask(
      'Restablecer contraseña',
      `Se asignará a ${row.fullName} la contraseña temporal ${password} y se cerrarán sus sesiones. Deberá cambiarla al entrar.`,
      'Restablecer',
      'lock_reset',
      '#f59e0b',
      () => this.staffService.resetPassword(row.id, password),
      `Contraseña temporal de ${row.email}: ${password} (cópiela y entréguesela)`,
      15000,
    );
  }

  private confirmToggle(row: StaffRow): void {
    const activate = !row.isActive;
    this.ask(
      activate ? 'Activar administrativo' : 'Desactivar administrativo',
      activate
        ? `${row.fullName} podrá volver a entrar al panel.`
        : `${row.fullName} no podrá entrar al panel y se cerrarán sus sesiones abiertas.`,
      activate ? 'Activar' : 'Desactivar',
      activate ? 'toggle_on' : 'toggle_off',
      activate ? '#22c55e' : '#ef4444',
      () => this.staffService.update(row.id, { isActive: activate }),
      activate ? 'Administrativo activado' : 'Administrativo desactivado',
    );
  }

  private confirmDelete(row: StaffRow): void {
    this.ask(
      'Eliminar administrativo',
      `Se eliminará la cuenta del panel de ${row.fullName} (${row.email}). Los usuarios de la app no se ven afectados.`,
      'Eliminar',
      'delete',
      '#ef4444',
      () => this.staffService.remove(row.id),
      'Administrativo eliminado',
    );
  }

  private ask(
    title: string,
    message: string,
    confirmText: string,
    icon: string,
    color: string,
    run: () => Observable<unknown>,
    done: string,
    duration = 3000,
  ): void {
    this.confirmDialog
      .confirm({ title, message, confirmText, cancelText: 'Cancelar', icon, color })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        run()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open(done, 'Cerrar', { duration });
              this.load();
            },
            error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo completar la acción', 'Cerrar', { duration: 5000 }),
          });
      });
  }
}
