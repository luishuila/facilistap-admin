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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { RoleService } from '../../services/role.service';
import { Role } from '../../../../core/models/role.interface';

export interface RoleFormDialogData {
  mode: 'create' | 'edit';
  role?: Role;
}

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="role-form-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>{{ data.mode === 'create' ? 'add' : 'edit' }}</mat-icon>
          </div>
          <div class="header-text">
            <h2 class="dialog-title">{{ dialogTitle }}</h2>
            <p class="dialog-subtitle">
              {{ data.mode === 'create' ? 'Cree un nuevo rol para el sistema' : 'Modifique los datos del rol' }}
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nombre del rol</mat-label>
          <input matInput formControlName="name" placeholder="Ej: Administrador" autocomplete="off" />
          <mat-icon matPrefix>badge</mat-icon>
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>El nombre es requerido</mat-error>
          }
          @if (form.get('name')?.hasError('minlength')) {
            <mat-error>Mínimo 3 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" placeholder="Describa el propósito del rol" rows="3" style="resize: none;"></textarea>
          <mat-icon matPrefix>description</mat-icon>
          @if (form.get('description')?.hasError('required') && form.get('description')?.touched) {
            <mat-error>La descripción es requerida</mat-error>
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
              <mat-icon>{{ data.mode === 'create' ? 'save' : 'check' }}</mat-icon>
            }
            <span>{{ data.mode === 'create' ? 'Crear Rol' : 'Guardar Cambios' }}</span>
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

      .role-form-dialog {
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
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .dialog-body mat-form-field {
        width: 100%;
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
export class RoleFormComponent implements OnInit {
  protected readonly data: RoleFormDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RoleFormComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected submitting = false;
  protected form!: FormGroup;

  get dialogTitle(): string {
    return this.data.mode === 'create' ? 'Crear Rol' : 'Editar Rol';
  }

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    const role = this.data.role;
    this.form = this.fb.group({
      name: [role?.name || '', [Validators.required, Validators.minLength(3)]],
      description: [role?.description || '', Validators.required],
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    const formValue = this.form.value;

    if (this.data.mode === 'create') {
      this.roleService
        .create(formValue)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackBar.open('Rol creado correctamente', 'Cerrar', {
              duration: 3000,
              panelClass: 'snackbar-success',
            });
            this.submitting = false;
            this.dialogRef.close(true);
          },
          error: () => {
            this.snackBar.open('Error al crear rol', 'Cerrar', {
              duration: 5000,
              panelClass: 'snackbar-error',
            });
            this.submitting = false;
          },
        });
    } else {
      this.roleService
        .update(this.data.role!.id, formValue)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.snackBar.open('Rol actualizado correctamente', 'Cerrar', {
              duration: 3000,
              panelClass: 'snackbar-success',
            });
            this.submitting = false;
            this.dialogRef.close(true);
          },
          error: () => {
            this.snackBar.open('Error al actualizar rol', 'Cerrar', {
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
