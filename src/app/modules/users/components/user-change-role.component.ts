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
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { UserService } from '../user.service';
import { RoleService } from '../../roles/role.service';
import { User } from '../../../core/models/user.interface';
import { Role } from '../../../core/models/role.interface';

export interface UserChangeRoleDialogData {
  user: User;
}

@Component({
  selector: 'app-user-change-role',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="change-role-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>swap_horiz</mat-icon>
          </div>
          <div class="header-text">
            <h2 class="dialog-title">Cambiar Rol</h2>
            <p class="dialog-subtitle">
              Asigne un nuevo rol al usuario <strong>{{ data.user.fullName }}</strong>
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <div class="current-role-info">
          <span class="info-label">Rol actual:</span>
          <span class="info-value">{{ data.user.roleName }}</span>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="role-select">
            <mat-label>Nuevo rol</mat-label>
            <mat-select formControlName="roleId">
              <mat-option [value]="null" disabled>Seleccione un rol</mat-option>
              @for (role of roles; track role.id) {
                <mat-option [value]="role.id">
                  {{ role.name }}
                  @if (role.isSystem) {
                    <span class="system-badge">(Sistema)</span>
                  }
                </mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>admin_panel_settings</mat-icon>
            @if (form.get('roleId')?.hasError('required') && form.get('roleId')?.touched) {
              <mat-error>Seleccione un rol</mat-error>
            }
          </mat-form-field>

          <div class="dialog-actions">
            <button mat-stroked-button type="button" (click)="onCancel()" [disabled]="submitting">
              Cancelar
            </button>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting">
              @if (submitting) {
                <mat-spinner diameter="20" color="accent"></mat-spinner>
              } @else {
                <mat-icon>check</mat-icon>
              }
              <span>Cambiar Rol</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .change-role-dialog {
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
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
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
      }

      .current-role-info {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        margin-bottom: 16px;
      }

      .info-label {
        font-size: 13px;
        color: #64748b;
        font-weight: 500;
      }

      .info-value {
        font-size: 14px;
        color: #1e293b;
        font-weight: 600;
      }

      .role-select {
        width: 100%;
      }

      .system-badge {
        font-size: 11px;
        color: #8b5cf6;
        font-weight: 500;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 8px 0 4px;

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
export class UserChangeRoleComponent implements OnInit {
  protected readonly data: UserChangeRoleDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<UserChangeRoleComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected roles: Role[] = [];
  protected submitting = false;

  protected form!: FormGroup;

  ngOnInit(): void {
    this.buildForm();
    this.loadRoles();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      roleId: [null, Validators.required],
    });
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
    const roleId = this.form.value.roleId;

    this.userService
      .changeRole(this.data.user.id, roleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Rol cambiado correctamente', 'Cerrar', {
            duration: 3000,
            panelClass: 'snackbar-success',
          });
          this.submitting = false;
          this.dialogRef.close(true);
        },
        error: () => {
          this.snackBar.open('Error al cambiar rol', 'Cerrar', {
            duration: 5000,
            panelClass: 'snackbar-error',
          });
          this.submitting = false;
        },
      });
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
