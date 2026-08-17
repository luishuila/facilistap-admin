import {
  Component,
  OnInit,
  inject,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { UserService } from '../../services/user.service';
import { RoleService } from '../../services/role.service';
import { User } from '../../../../core/models/user.interface';
import { Role } from '../../../../core/models/role.interface';

export interface UserFormDialogData {
  mode: 'create' | 'edit';
  user?: User;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="user-form-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>{{ data.mode === 'create' ? 'person_add' : 'edit' }}</mat-icon>
          </div>
          <div class="header-text">
            <h2 class="dialog-title">{{ dialogTitle }}</h2>
            <p class="dialog-subtitle">
              {{ data.mode === 'create' ? 'Complete los datos para crear un nuevo usuario' : 'Modifique los datos del usuario' }}
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <div class="form-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nombre de usuario</mat-label>
            <input matInput formControlName="username" placeholder="Ej: juan123" autocomplete="off" />
            <mat-icon matPrefix>person</mat-icon>
            @if (form.get('username')?.hasError('required') && form.get('username')?.touched) {
              <mat-error>El nombre de usuario es requerido</mat-error>
            }
            @if (form.get('username')?.hasError('minlength')) {
              <mat-error>Mínimo 3 caracteres</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" placeholder="Ej: usuario@correo.com" autocomplete="off" />
            <mat-icon matPrefix>email</mat-icon>
            @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
              <mat-error>El email es requerido</mat-error>
            }
            @if (form.get('email')?.hasError('email')) {
              <mat-error>Ingrese un email válido</mat-error>
            }
          </mat-form-field>
        </div>

        @if (data.mode === 'create') {
          <div class="form-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Contraseña</mat-label>
              <input matInput formControlName="password" [type]="hidePassword ? 'password' : 'text'" autocomplete="new-password" />
              <mat-icon matPrefix>lock</mat-icon>
              <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword">
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <mat-error>La contraseña es requerida</mat-error>
              }
              @if (form.get('password')?.hasError('minlength')) {
                <mat-error>Mínimo 6 caracteres</mat-error>
              }
            </mat-form-field>
          </div>
        }

        <div class="form-row two-cols">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="firstName" placeholder="Ej: Juan" autocomplete="off" />
            <mat-icon matPrefix>badge</mat-icon>
            @if (form.get('firstName')?.hasError('required') && form.get('firstName')?.touched) {
              <mat-error>El nombre es requerido</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Apellido</mat-label>
            <input matInput formControlName="lastName" placeholder="Ej: Pérez" autocomplete="off" />
            @if (form.get('lastName')?.hasError('required') && form.get('lastName')?.touched) {
              <mat-error>El apellido es requerido</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Teléfono</mat-label>
            <input matInput formControlName="phone" placeholder="Ej: +591 12345678" autocomplete="off" />
            <mat-icon matPrefix>phone</mat-icon>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Rol</mat-label>
            <mat-select formControlName="roleId">
              <mat-option [value]="null" disabled>Seleccione un rol</mat-option>
              @for (role of roles; track role.id) {
                <mat-option [value]="role.id">{{ role.name }}</mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>admin_panel_settings</mat-icon>
            @if (form.get('roleId')?.hasError('required') && form.get('roleId')?.touched) {
              <mat-error>El rol es requerido</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="onCancel()" [disabled]="submitting">
            Cancelar
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting">
            @if (submitting) {
              <mat-spinner diameter="20" color="accent"></mat-spinner>
            } @else {
              <mat-icon>{{ data.mode === 'create' ? 'save' : 'check' }}</mat-icon>
            }
            <span>{{ data.mode === 'create' ? 'Crear Usuario' : 'Guardar Cambios' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .user-form-dialog {
        padding: 8px;
      }

      .dialog-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 0 8px 16px;
      }

      .header-content {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }

      .header-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          color: #fff;
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .header-text {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .dialog-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
      }

      .dialog-subtitle {
        margin: 0;
        font-size: 13px;
        color: #64748b;
      }

      .close-btn {
        color: #94a3b8;
      }

      .dialog-body {
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .form-row {
        width: 100%;

        mat-form-field {
          width: 100%;
        }
      }

      .form-row.two-cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 0 4px;

        button {
          border-radius: 8px;
          padding: 0 24px;
          font-weight: 500;
          height: 44px;
        }

        button[mat-flat-button] {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    `,
  ],
})
export class UserFormComponent implements OnInit {
  protected readonly data: UserFormDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UserFormComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected roles: Role[] = [];
  protected hidePassword = true;
  protected submitting = false;

  protected form!: FormGroup;

  get dialogTitle(): string {
    return this.data.mode === 'create' ? 'Crear Usuario' : 'Editar Usuario';
  }

  ngOnInit(): void {
    this.buildForm();
    this.loadRoles();
  }

  private buildForm(): void {
    const user = this.data.user;
    this.form = this.fb.group({
      username: [user?.username || '', [Validators.required, Validators.minLength(3)]],
      email: [user?.email || '', [Validators.required, Validators.email]],
      firstName: [user?.firstName || '', Validators.required],
      lastName: [user?.lastName || '', Validators.required],
      phone: [user?.phone || ''],
      roleId: [user?.roleId || null, Validators.required],
    });

    if (this.data.mode === 'create') {
      this.form.addControl(
        'password',
        this.fb.control('', [Validators.required, Validators.minLength(6)])
      );
    }
  }

  private loadRoles(): void {
    this.roleService
      .getAll({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => (this.roles = res.items),
        error: () => {
          this.snackBar.open('Error al cargar roles', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
        },
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    const formValue = this.form.value;

    if (this.data.mode === 'create') {
      const payload = {
        username: formValue.username,
        email: formValue.email,
        password: formValue.password,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        phone: formValue.phone || null,
        roleId: formValue.roleId,
      };
      this.userService
        .create(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackBar.open('Usuario creado correctamente', 'Cerrar', {
              duration: 3000,
              panelClass: 'snackbar-success',
            });
            this.submitting = false;
            this.dialogRef.close(true);
          },
          error: () => {
            this.snackBar.open('Error al crear usuario', 'Cerrar', {
              duration: 5000,
              panelClass: 'snackbar-error',
            });
            this.submitting = false;
          },
        });
    } else {
      const payload = {
        username: formValue.username,
        email: formValue.email,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        phone: formValue.phone || null,
        roleId: formValue.roleId,
      };
      this.userService
        .update(this.data.user!.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackBar.open('Usuario actualizado correctamente', 'Cerrar', {
              duration: 3000,
              panelClass: 'snackbar-success',
            });
            this.submitting = false;
            this.dialogRef.close(true);
          },
          error: () => {
            this.snackBar.open('Error al actualizar usuario', 'Cerrar', {
              duration: 5000,
              panelClass: 'snackbar-error',
            });
            this.submitting = false;
          },
        });
    }
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
