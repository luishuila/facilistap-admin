import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize, take } from 'rxjs';

import { PermissionService } from '../permission.service';
import { Permission } from '../../../core/models/permission.interface';

const VALID_ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'] as const;

@Component({
  selector: 'app-permission-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-dialog">
      <div class="dialog-header">
        <h2 class="dialog-title">{{ permission ? 'Editar Permiso' : 'Nuevo Permiso' }}</h2>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-body">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" placeholder="Ej: users.create" autocomplete="off" />
          @if (form.get('name')?.hasError('required')) {
            <mat-error>El nombre es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" placeholder="Descripción del permiso" rows="3"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Módulo</mat-label>
          <input matInput formControlName="module" placeholder="Ej: users, roles, pqrs" autocomplete="off" />
          @if (form.get('module')?.hasError('required')) {
            <mat-error>El módulo es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Acción</mat-label>
          <mat-select formControlName="action">
            @for (action of actions; track action) {
              <mat-option [value]="action">
                <div class="action-option">
                  <span class="action-dot" [style.background]="actionColor(action)"></span>
                  <span>{{ actionLabel(action) }}</span>
                </div>
              </mat-option>
            }
          </mat-select>
          @if (form.get('action')?.hasError('required')) {
            <mat-error>La acción es requerida</mat-error>
          }
        </mat-form-field>

        <div class="form-actions">
          <button mat-stroked-button type="button" (click)="close()" [disabled]="submitting()">
            Cancelar
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
            @if (submitting()) {
              <mat-icon class="spin">refresh</mat-icon>
            }
            <span>{{ permission ? 'Actualizar' : 'Crear' }}</span>
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

      .form-dialog {
        padding: 8px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      .dialog-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
      }

      .close-btn {
        flex-shrink: 0;
      }

      .form-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .full-width {
        width: 100%;
      }

      .action-option {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .action-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 16px;

        button {
          border-radius: 8px;
          font-weight: 500;
          min-width: 110px;
        }
      }

      .spin {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `,
  ],
})
export class PermissionFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly permissionService = inject(PermissionService);
  private readonly dialogRef = inject(MatDialogRef<PermissionFormComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly data: { permission?: Permission } = inject(MAT_DIALOG_DATA);

  protected readonly permission = this.data?.permission;
  protected readonly actions = [...VALID_ACTIONS];
  protected readonly submitting = signal(false);

  protected form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.permission?.name || '', [Validators.required]],
      description: [this.permission?.description || ''],
      module: [this.permission?.module || '', [Validators.required]],
      action: [this.permission?.action || '', [Validators.required]],
    });
  }

  protected actionColor(action: string): string {
    const colors: Record<string, string> = {
      CREATE: '#22c55e',
      READ: '#3b82f6',
      UPDATE: '#f59e0b',
      DELETE: '#ef4444',
    };
    return colors[action] || '#94a3b8';
  }

  protected actionLabel(action: string): string {
    const labels: Record<string, string> = {
      CREATE: 'Crear',
      READ: 'Leer',
      UPDATE: 'Actualizar',
      DELETE: 'Eliminar',
    };
    return labels[action] || action;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const data = this.form.value;

    const request = this.permission
      ? this.permissionService.update(this.permission.id, data)
      : this.permissionService.create(data);

    request
      .pipe(take(1))
      .subscribe({
        next: () => {
          const msg = this.permission
            ? 'Permiso actualizado correctamente'
            : 'Permiso creado correctamente';
          this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.snackBar.open('Error al guardar el permiso', 'Cerrar', { duration: 5000 });
          this.submitting.set(false);
        },
      });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
