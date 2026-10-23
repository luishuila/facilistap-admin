import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, finalize } from 'rxjs';

import {
  AssistantPermissionKey,
  AssistantPermissions,
  EmployeeRoleCatalog,
  EmployeeRoleCode,
  EmployeeRoleRow,
  EmployeeRoleService,
  EmployeeRoleType,
} from '../../services/employee-role.service';

export interface EmployeeRoleFormData {
  row: EmployeeRoleRow;
  /** Roles del catalogo que se pueden asignar. */
  types: EmployeeRoleType[];
}

/** Mismos valores de inicio que el backend para un asistente nuevo. */
const DEFAULT_PERMISSIONS: AssistantPermissions = {
  replyMessages: true, editProfile: false, publishPosts: false, manageRefunds: false, manageServices: false,
  viewDashboard: false, manageEmployees: false, manageBranches: false,
};
/** Opcion "Personalizado": marcar Empleado/Asistente y permisos a mano. */
const CUSTOM = 'custom';

@Component({
  selector: 'app-employee-role-form',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>assignment_ind</mat-icon></div>
        <div>
          <h2>Rol en la empresa</h2>
          <p>{{ row.userFullName }} · {{ row.providerName || 'Sin empresa' }}</p>
        </div>
      </div>

      <div class="section">
        <span class="section-title">Elija el rol</span>
        <div class="options">
          @for (t of data.types; track t.id) {
            <button type="button" class="option" [class.selected]="selected() === t.id" (click)="selected.set(t.id)">
              <mat-icon>{{ selected() === t.id ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
              <span>
                <strong>{{ t.name }}</strong>
                <small>{{ describe(t) }}</small>
              </span>
            </button>
          }
          <button type="button" class="option" [class.selected]="selected() === CUSTOM" (click)="selected.set(CUSTOM)">
            <mat-icon>{{ selected() === CUSTOM ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
            <span>
              <strong>Personalizado</strong>
              <small>Marcar las funciones y permisos a mano.</small>
            </span>
          </button>
        </div>
      </div>

      @if (selected() === CUSTOM) {
        <div class="section">
          <span class="section-title">Funciones</span>
          @for (r of catalog()?.roles ?? []; track r.code) {
            <label class="role-option" [class.checked]="roles().has(r.code)">
              <mat-checkbox color="primary" [checked]="roles().has(r.code)" (change)="toggleRole(r.code, $event.checked)" />
              <span>
                <strong>{{ r.label }}</strong>
                <small>{{ r.description }}</small>
              </span>
            </label>
          }
          @if (!roles().size) {
            <p class="warn">Elija al menos una.</p>
          }
        </div>

        @if (roles().has('ASSISTANT')) {
          <div class="section">
            <span class="section-title">Permisos del asistente</span>
            @for (p of catalog()?.permissions ?? []; track p.key) {
              <div class="perm">
                <span>
                  <strong>{{ p.label }}</strong>
                  <small>{{ p.description }}</small>
                </span>
                <mat-slide-toggle color="primary" [checked]="permissions()[p.key]" (change)="setPermission(p.key, $event.checked)" />
              </div>
            }
          </div>
        }
      }

      <p class="note">
        <mat-icon>info</mat-icon>
        Se aplica al instante en la app (el menú de la persona se actualiza solo).
      </p>

      <div class="actions">
        <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="saving()">Cancelar</button>
        <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="saving() || !valid()">
          @if (saving()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          Guardar
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog { padding: 8px 16px; max-width: 580px; display: flex; flex-direction: column; gap: 14px; }
      .dialog-header { display: flex; gap: 14px; align-items: flex-start; padding-top: 4px;
        h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .header-icon { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; background: var(--fac-gradient);
        display: flex; align-items: center; justify-content: center; mat-icon { color: #fff; } }
      .section { display: flex; flex-direction: column; gap: 8px; }
      .section-title { font-size: 13px; font-weight: 600; color: var(--fac-text-muted); text-transform: uppercase; }
      .options { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; }
      .option { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--fac-border);
        border-radius: 12px; background: #fff; cursor: pointer; text-align: left; font: inherit;
        mat-icon { color: var(--fac-text-muted); flex-shrink: 0; }
        &.selected { border-color: #93c5fd; background: #eff6ff; mat-icon { color: var(--fac-primary-deep, #0078ff); } } }
      .option span, .role-option span, .perm span { display: flex; flex-direction: column;
        strong { font-size: 14px; color: var(--fac-text); }
        small { font-size: 12px; color: var(--fac-text-muted); } }
      .role-option { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border: 1px solid var(--fac-border);
        border-radius: 12px; cursor: pointer;
        &.checked { border-color: #93c5fd; background: #eff6ff; } }
      .perm { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px;
        border: 1px solid var(--fac-border); border-radius: 12px; }
      .warn { margin: 0; font-size: 12px; color: #b45309; }
      .note { display: flex; gap: 6px; align-items: flex-start; margin: 0; font-size: 12px; color: var(--fac-text-muted);
        mat-icon { font-size: 16px; width: 16px; height: 16px; } }
      .actions { display: flex; justify-content: flex-end; gap: 12px; padding-bottom: 8px;
        button { border-radius: 10px; height: 44px; padding: 0 22px; display: inline-flex; align-items: center; gap: 6px; } }
    `,
  ],
})
export class EmployeeRoleFormComponent implements OnInit {
  protected readonly data: EmployeeRoleFormData = inject(MAT_DIALOG_DATA);
  protected readonly row = this.data.row;
  protected readonly dialogRef = inject(MatDialogRef<EmployeeRoleFormComponent, boolean>);
  private readonly service = inject(EmployeeRoleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly CUSTOM = CUSTOM;
  protected readonly catalog = signal<EmployeeRoleCatalog | null>(null);
  protected readonly saving = signal(false);
  protected readonly selected = signal<number | typeof CUSTOM>(this.row.roleTypeId ?? CUSTOM);
  protected readonly roles = signal(new Set<EmployeeRoleCode>(this.row.roles));
  protected readonly permissions = signal<AssistantPermissions>({ ...(this.row.assistantPermissions ?? DEFAULT_PERMISSIONS) });

  protected readonly valid = computed(() => this.selected() !== CUSTOM || this.roles().size > 0);

  ngOnInit(): void {
    this.service
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((c) => this.catalog.set(c));
  }

  protected describe(t: EmployeeRoleType): string {
    const parts = [t.attendsServices ? 'Atiende servicios' : null, t.managesAgenda ? 'Gestiona agenda' : null].filter(Boolean);
    return t.description || parts.join(' + ');
  }

  protected toggleRole(code: EmployeeRoleCode, checked: boolean): void {
    this.roles.update((set) => {
      const next = new Set(set);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  protected setPermission(key: AssistantPermissionKey, value: boolean): void {
    this.permissions.update((p) => ({ ...p, [key]: value }));
  }

  protected save(): void {
    if (!this.valid()) return;
    const choice = this.selected();
    let request$: Observable<unknown>;
    if (choice === CUSTOM) {
      const roles = [...this.roles()];
      request$ = this.service.setRoles(this.row.id, roles, roles.includes('ASSISTANT') ? this.permissions() : undefined);
    } else {
      request$ = this.service.setRoleType(this.row.id, choice);
    }

    this.saving.set(true);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Rol actualizado', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar el rol', 'Cerrar', { duration: 5000 }),
      });
  }
}
