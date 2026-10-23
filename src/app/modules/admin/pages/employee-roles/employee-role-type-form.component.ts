import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import {
  EmployeeRoleCatalog,
  EmployeeRoleService,
  EmployeeRoleType,
  SaveEmployeeRoleType,
} from '../../services/employee-role.service';

@Component({
  selector: 'app-employee-role-type-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    LocalizedNameFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>{{ isEdit ? 'edit' : 'add_moderator' }}</mat-icon></div>
        <div>
          <h2>{{ isEdit ? 'Editar rol' : 'Nuevo rol de empleado' }}</h2>
          <p>El dueño del negocio lo verá en la app al agregar o editar un empleado.</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="body">
        <div class="grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nombre del rol</mat-label>
            <input matInput formControlName="name" placeholder="Recepcionista" autocomplete="off" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Orden</mat-label>
            <input matInput type="number" min="0" formControlName="sortOrder" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
            <mat-label>Descripción (opcional)</mat-label>
            <input matInput formControlName="description" placeholder="Atiende la recepción y gestiona las agendas" autocomplete="off" />
          </mat-form-field>
        </div>

        <app-localized-name-fields [group]="localizedGroup" [initial]="data?.localizedName" title="Nombre en cada idioma de la app" />

        <div class="section">
          <span class="section-title">Funciones</span>
          @if (data?.isSystem) {
            <p class="hint">Rol del sistema: sus funciones no se cambian (solo nombre y permisos).</p>
          }
          <div class="row">
            <span>
              <strong>Atiende servicios</strong>
              <small>Aparece para reservar y recibe agendas.</small>
            </span>
            <mat-slide-toggle color="primary" formControlName="attendsServices" />
          </div>
          <div class="row">
            <span>
              <strong>Gestiona la agenda</strong>
              <small>Maneja las agendas de la empresa (como un asistente).</small>
            </span>
            <mat-slide-toggle color="primary" formControlName="managesAgenda" />
          </div>
          @if (!form.value.attendsServices && !form.value.managesAgenda && !data?.isSystem) {
            <p class="warn">Active al menos una función.</p>
          }
        </div>

        @if (form.getRawValue().managesAgenda) {
          <div class="section">
            <span class="section-title">Permisos</span>
            @for (p of catalog()?.permissions ?? []; track p.key) {
              <div class="row">
                <span>
                  <strong>{{ p.label }}</strong>
                  <small>{{ p.description }}</small>
                </span>
                <mat-slide-toggle color="primary" [formControl]="permControl(p.key)" />
              </div>
            }
          </div>
        }

        <mat-slide-toggle color="primary" formControlName="isActive">Activo (se muestra en la app)</mat-slide-toggle>

        @if (isEdit && data!.employeesCount) {
          <p class="hint">
            <mat-icon>sync</mat-icon>
            {{ data!.employeesCount }} empleado(s) tienen este rol: si cambia funciones o permisos, se les aplica al guardar.
          </p>
        }

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="saving()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving() || noFunction()">
            @if (saving()) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon>
            }
            {{ isEdit ? 'Guardar cambios' : 'Crear rol' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .dialog { padding: 8px 16px; max-width: 720px; }
      .dialog-header { display: flex; gap: 14px; align-items: flex-start; padding: 4px 0 16px;
        h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .header-icon { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; background: var(--fac-gradient);
        display: flex; align-items: center; justify-content: center; mat-icon { color: #fff; } }
      .body { display: flex; flex-direction: column; gap: 14px; }
      .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 10px 12px; mat-form-field { width: 100%; } }
      .span-2 { grid-column: 1 / -1; }
      .section { display: flex; flex-direction: column; gap: 8px; }
      .section-title { font-size: 13px; font-weight: 600; color: var(--fac-text-muted); text-transform: uppercase; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px;
        border: 1px solid var(--fac-border); border-radius: 12px;
        span { display: flex; flex-direction: column; }
        strong { font-size: 14px; color: var(--fac-text); }
        small { font-size: 12px; color: var(--fac-text-muted); } }
      .hint { display: flex; gap: 6px; align-items: center; margin: 0; font-size: 12px; color: var(--fac-text-muted);
        mat-icon { font-size: 16px; width: 16px; height: 16px; } }
      .warn { margin: 0; font-size: 12px; color: #b45309; }
      .actions { display: flex; justify-content: flex-end; gap: 12px; padding-bottom: 8px;
        button { border-radius: 10px; height: 44px; padding: 0 22px; display: inline-flex; align-items: center; gap: 6px; } }
      @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    `,
  ],
})
export class EmployeeRoleTypeFormComponent implements OnInit {
  protected readonly data: EmployeeRoleType | null = inject(MAT_DIALOG_DATA, { optional: true });
  protected readonly dialogRef = inject(MatDialogRef<EmployeeRoleTypeFormComponent, boolean>);
  private readonly service = inject(EmployeeRoleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data;
  protected readonly saving = signal(false);
  protected readonly catalog = signal<EmployeeRoleCatalog | null>(null);
  protected readonly localizedGroup = new FormGroup({});

  protected readonly form = this.fb.group({
    name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(60)]],
    description: [this.data?.description ?? '', [Validators.maxLength(200)]],
    sortOrder: [this.data?.sortOrder ?? 100, [Validators.min(0)]],
    attendsServices: [this.data?.attendsServices ?? true],
    managesAgenda: [this.data?.managesAgenda ?? false],
    isActive: [this.data?.isActive ?? true],
    perms: this.fb.group({
      replyMessages: [this.data?.permissions?.replyMessages ?? true],
      editProfile: [this.data?.permissions?.editProfile ?? false],
      publishPosts: [this.data?.permissions?.publishPosts ?? false],
      manageRefunds: [this.data?.permissions?.manageRefunds ?? false],
      manageServices: [this.data?.permissions?.manageServices ?? false],
      viewDashboard: [this.data?.permissions?.viewDashboard ?? false],
      manageEmployees: [this.data?.permissions?.manageEmployees ?? false],
      manageBranches: [this.data?.permissions?.manageBranches ?? false],
    }),
  });

  ngOnInit(): void {
    if (this.data?.isSystem) {
      this.form.controls.attendsServices.disable();
      this.form.controls.managesAgenda.disable();
    }
    this.service
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((c) => this.catalog.set(c));
  }

  protected permControl(key: string) {
    return this.form.controls.perms.get(key) as any;
  }

  protected noFunction(): boolean {
    const v = this.form.getRawValue();
    return !v.attendsServices && !v.managesAgenda;
  }

  protected save(): void {
    if (this.form.invalid || this.noFunction()) return;
    const v = this.form.getRawValue();
    const payload: SaveEmployeeRoleType = {
      name: v.name!.trim(),
      description: v.description?.trim() || '',
      sortOrder: Number(v.sortOrder ?? 0),
      isActive: !!v.isActive,
      localizedName: toLocalizedName(this.localizedGroup.getRawValue()) ?? { es: v.name!.trim() },
      permissions: {
        replyMessages: !!v.perms.replyMessages,
        editProfile: !!v.perms.editProfile,
        publishPosts: !!v.perms.publishPosts,
        manageRefunds: !!v.perms.manageRefunds,
        manageServices: !!v.perms.manageServices,
        viewDashboard: !!v.perms.viewDashboard,
        manageEmployees: !!v.perms.manageEmployees,
        manageBranches: !!v.perms.manageBranches,
      },
    };
    if (!this.data?.isSystem) {
      payload.attendsServices = !!v.attendsServices;
      payload.managesAgenda = !!v.managesAgenda;
    }

    this.saving.set(true);
    const request$ = this.isEdit ? this.service.updateType(this.data!.id, payload) : this.service.createType(payload);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const updated = (res.data as { updatedEmployees?: number } | undefined)?.updatedEmployees ?? 0;
          const msg = this.isEdit
            ? updated
              ? `Rol actualizado y aplicado a ${updated} empleado(s)`
              : 'Rol actualizado'
            : 'Rol creado: ya aparece en la app';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.dialogRef.close(true);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar el rol', 'Cerrar', { duration: 5000 }),
      });
  }
}
