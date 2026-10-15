import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

/** Cambiar la contraseña de la propia cuenta del panel (cierra las demas sesiones). */
@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Cambiar contraseña</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Contraseña actual</mat-label>
          <input matInput type="password" formControlName="current" autocomplete="current-password" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nueva contraseña</mat-label>
          <input matInput type="password" formControlName="next" autocomplete="new-password" />
          <mat-hint>Mínimo 10 caracteres, con mayúscula, minúscula y número</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Repita la nueva contraseña</mat-label>
          <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          @if (form.hasError('mismatch') && form.get('confirm')?.touched) {
            <mat-error>No coincide</mat-error>
          }
        </mat-form-field>
        <p class="note">Se cerrarán sus sesiones abiertas en otros equipos.</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button type="button" mat-dialog-close [disabled]="saving()">Cancelar</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
          @if (saving()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          Guardar
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [
    `
      .content { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; }
      .content mat-form-field { width: 100%; }
      .note { margin: 0; font-size: 12px; color: var(--fac-text-muted); }
      button { border-radius: 10px; display: inline-flex; align-items: center; gap: 6px; }
    `,
  ],
})
export class ChangePasswordDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group(
    {
      current: ['', Validators.required],
      next: ['', [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/)]],
      confirm: ['', Validators.required],
    },
    {
      validators: (g: AbstractControl): ValidationErrors | null =>
        g.get('next')?.value === g.get('confirm')?.value ? null : { mismatch: true },
    },
  );

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.auth.changePassword(this.form.value.current!, this.form.value.next!).subscribe({
      next: () => {
        this.snackBar.open('Contraseña actualizada', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.snackBar.open(err?.message || 'No se pudo cambiar la contraseña', 'Cerrar', { duration: 5000 });
      },
    });
  }
}
