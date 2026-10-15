import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { PanelModuleOption, SaveStaff, StaffMember, StaffService } from '../../services/staff.service';

/** Sin `staff`: cuenta nueva. Con `staff`: editar datos, estado y modulos. */
export interface StaffFormData {
  staff?: StaffMember;
  /** Id de la cuenta logueada (no puede quitarse a si misma el super admin ni desactivarse). */
  selfId?: string | null;
}

/** Mismo criterio que el backend: 10+ caracteres con mayuscula, minuscula y numero. */
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="staff-dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>{{ isEdit ? 'manage_accounts' : 'person_add' }}</mat-icon></div>
        <div>
          <h2>{{ isEdit ? 'Editar administrativo' : 'Nuevo administrativo' }}</h2>
          <p>Cuenta del panel administrativo (separada de los usuarios de la app).</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="dialog-body">
        <div class="grid-2">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Apellido</mat-label>
            <input matInput formControlName="lastname" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Email (para iniciar sesión)</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="off" />
            @if (form.get('email')?.hasError('email')) {
              <mat-error>Email inválido</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Teléfono (opcional)</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>
          @if (!isEdit) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
              <mat-label>Contraseña temporal</mat-label>
              <input matInput formControlName="password" autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" (click)="generate()" matTooltip="Generar contraseña segura">
                <mat-icon>autorenew</mat-icon>
              </button>
              <mat-hint>Entréguesela a la persona: deberá cambiarla en su primer ingreso.</mat-hint>
              @if (form.get('password')?.hasError('pattern')) {
                <mat-error>Mínimo 10 caracteres, con mayúscula, minúscula y número</mat-error>
              }
            </mat-form-field>
          }
        </div>

        <div class="toggles">
          <mat-slide-toggle color="primary" formControlName="isSuperAdmin">
            Super Admin (acceso a todo y gestiona administrativos)
          </mat-slide-toggle>
          @if (isEdit) {
            <mat-slide-toggle color="primary" formControlName="isActive">Cuenta activa</mat-slide-toggle>
          }
          @if (isSelf) {
            <p class="warn">Es su propia cuenta: no puede quitarse el Super Admin ni desactivarse.</p>
          }
        </div>

        @if (!form.value.isSuperAdmin) {
          <div class="modules-box">
            <div class="modules-head">
              <span>Módulos permitidos</span>
              <span>
                <button mat-button type="button" (click)="setAll(true)">Todos</button>
                <button mat-button type="button" (click)="setAll(false)">Ninguno</button>
              </span>
            </div>
            <div class="modules-grid">
              @for (m of modules(); track m.code) {
                <mat-checkbox color="primary" [checked]="selected().has(m.code)" (change)="toggle(m.code, $event.checked)">
                  {{ m.label }}
                </mat-checkbox>
              }
            </div>
            @if (!selected().size) {
              <p class="warn">Sin módulos no podrá entrar al panel.</p>
            }
          </div>
        }

        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="saving()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="saving() || form.invalid">
            @if (saving()) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon>
            }
            {{ isEdit ? 'Guardar cambios' : 'Crear administrativo' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .staff-dialog { padding: 8px; max-width: 760px; }
      .dialog-header {
        display: flex; gap: 14px; align-items: flex-start; padding: 4px 8px 16px;
        h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); }
      }
      .header-icon {
        width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; background: var(--fac-gradient);
        display: flex; align-items: center; justify-content: center; mat-icon { color: #fff; }
      }
      .dialog-body { display: flex; flex-direction: column; gap: 14px; padding: 0 8px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
      .grid-2 mat-form-field { width: 100%; }
      .span-2 { grid-column: 1 / -1; }
      .toggles { display: flex; flex-direction: column; gap: 8px; }
      .modules-box { border: 1px solid var(--fac-border); border-radius: 12px; padding: 10px 14px; background: #fbfcfe; }
      .modules-head { display: flex; align-items: center; justify-content: space-between; font-weight: 600; color: var(--fac-text); }
      .modules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 2px 8px; }
      .warn { margin: 6px 0 0; font-size: 12px; color: #b45309; }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding: 4px 0;
        button { border-radius: 10px; height: 44px; padding: 0 22px; display: inline-flex; align-items: center; gap: 6px; }
      }
      @media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
    `,
  ],
})
export class StaffFormComponent implements OnInit {
  protected readonly data: StaffFormData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly dialogRef = inject(MatDialogRef<StaffFormComponent, boolean>);
  private readonly staffService = inject(StaffService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.staff;
  protected readonly isSelf = !!this.data.staff && this.data.staff.id === this.data.selfId;
  protected readonly modules = signal<PanelModuleOption[]>([]);
  protected readonly selected = signal(new Set<string>(this.data.staff?.modules ?? []));
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: [this.data.staff?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    lastname: [this.data.staff?.lastname ?? '', [Validators.maxLength(100)]],
    email: [this.data.staff?.email ?? '', [Validators.required, Validators.email]],
    phone: [this.data.staff?.phone ?? ''],
    password: [this.isEdit ? 'no-aplica' : this.staffService.generatePassword(), this.isEdit ? [] : [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
    isSuperAdmin: [this.data.staff?.isSuperAdmin ?? false],
    isActive: [this.data.staff?.isActive ?? true],
  });

  ngOnInit(): void {
    if (this.isSelf) {
      this.form.controls.isSuperAdmin.disable();
      this.form.controls.isActive.disable();
    }
    this.staffService
      .modules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (m) => this.modules.set(m) });
  }

  protected generate(): void {
    this.form.patchValue({ password: this.staffService.generatePassword() });
  }

  protected toggle(code: string, checked: boolean): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  protected setAll(on: boolean): void {
    this.selected.set(new Set(on ? this.modules().map((m) => m.code) : []));
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload: SaveStaff = {
      name: v.name!.trim(),
      lastname: v.lastname?.trim() || undefined,
      email: v.email!.trim().toLowerCase(),
      phone: v.phone?.trim() || undefined,
      isSuperAdmin: !!v.isSuperAdmin,
      modules: v.isSuperAdmin ? [] : [...this.selected()],
    };
    if (!this.isEdit) payload.password = v.password!;
    else payload.isActive = !!v.isActive;

    this.saving.set(true);
    const request$ = this.isEdit
      ? this.staffService.update(this.data.staff!.id, payload)
      : this.staffService.create(payload);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const msg = this.isEdit
            ? 'Cambios guardados'
            : `Administrativo creado. Contraseña temporal: ${v.password} (cópiela y entréguesela)`;
          this.snackBar.open(msg, 'Cerrar', { duration: this.isEdit ? 3000 : 15000 });
          this.dialogRef.close(true);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar', 'Cerrar', { duration: 5000 }),
      });
  }
}
