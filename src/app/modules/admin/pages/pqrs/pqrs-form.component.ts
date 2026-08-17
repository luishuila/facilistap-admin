import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { take } from 'rxjs';

import { PqrsService } from '../../services/pqrs.service';
import { UserService } from '../../services/user.service';
import { PqrsType } from '../../../../core/models/pqrs.interface';
import { User } from '../../../../core/models/user.interface';
import { PaginatedQuery } from '../../../../core/models/paginated-query.interface';

const TYPE_LABELS: { value: PqrsType; label: string }[] = [
  { value: 'QUEJA', label: 'Queja' },
  { value: 'PETICION', label: 'Petición' },
  { value: 'RECLAMO', label: 'Reclamo' },
  { value: 'SUGERENCIA', label: 'Sugerencia' },
];

@Component({
  selector: 'app-pqrs-form',
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
        <h2 class="dialog-title">Nuevo PQRS</h2>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-body">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="type">
            @for (item of types; track item.value) {
              <mat-option [value]="item.value">{{ item.label }}</mat-option>
            }
          </mat-select>
          @if (form.get('type')?.hasError('required')) {
            <mat-error>El tipo es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Asunto</mat-label>
          <input matInput formControlName="subject" placeholder="Asunto del PQRS" autocomplete="off" />
          @if (form.get('subject')?.hasError('required')) {
            <mat-error>El asunto es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" placeholder="Descripción detallada" rows="4"></textarea>
          @if (form.get('description')?.hasError('required')) {
            <mat-error>La descripción es requerida</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Usuario</mat-label>
          <mat-select formControlName="userId">
            @for (user of userList(); track user.id) {
              <mat-option [value]="user.id">{{ user.fullName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="form-actions">
          <button mat-stroked-button type="button" (click)="close()" [disabled]="submitting()">
            Cancelar
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
            @if (submitting()) {
              <mat-icon class="spin">refresh</mat-icon>
            }
            <span>Crear</span>
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
export class PqrsFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly pqrsService = inject(PqrsService);
  private readonly userService = inject(UserService);
  private readonly dialogRef = inject(MatDialogRef<PqrsFormComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(MAT_DIALOG_DATA) as Record<string, never>;

  protected readonly types = TYPE_LABELS;
  protected readonly userList = signal<User[]>([]);
  protected readonly submitting = signal(false);

  protected form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      type: ['', [Validators.required]],
      subject: ['', [Validators.required]],
      description: ['', [Validators.required]],
      userId: [null as number | null],
    });

    this.loadUsers();
  }

  private loadUsers(): void {
    const query: PaginatedQuery = { limit: 200 };
    this.userService
      .getAll(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.userList.set(res.items.filter((u) => u.isActive && !u.isBlocked));
        },
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const data = this.form.value;

    this.pqrsService
      .create(data)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.snackBar.open('PQRS creado correctamente', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.snackBar.open('Error al crear PQRS', 'Cerrar', { duration: 5000 });
          this.submitting.set(false);
        },
      });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
