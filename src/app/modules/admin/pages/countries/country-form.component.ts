import {
  Component,
  inject,
  signal,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CountryService } from '../../services/country.service';
import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import { Country } from '../../../../core/models/country.interface';

export interface CountryFormData {
  country?: Country;
}

@Component({
  selector: 'app-country-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    LocalizedNameFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="geo-form-dialog">
      <div class="dialog-header">
        <h2>{{ isEdit ? 'Editar País' : 'Nuevo País' }}</h2>
        <button mat-icon-button type="button" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Código ISO (2 letras)</mat-label>
          <input matInput formControlName="countryCode" placeholder="Ej: CO" maxlength="2" />
          @if (form.get('countryCode')?.hasError('required') && form.get('countryCode')?.touched) {
            <mat-error>El código es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nombre principal (español)</mat-label>
          <input matInput formControlName="countryName" placeholder="Ej: Colombia" />
          @if (form.get('countryName')?.hasError('required') && form.get('countryName')?.touched) {
            <mat-error>El nombre es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Continente</mat-label>
          <input matInput formControlName="countryContinent" placeholder="Ej: América del Sur" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Indicativo telefónico</mat-label>
          <input matInput formControlName="dialCode" placeholder="Ej: 57" />
        </mat-form-field>

        <app-localized-name-fields [group]="localizedGroup" [initial]="data.country?.localizedName" />

        <mat-slide-toggle formControlName="status">Activo</mat-slide-toggle>

        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="onCancel()" [disabled]="submitting()">
            Cancelar
          </button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
            @if (submitting()) {
              <mat-spinner diameter="20" color="accent"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon>
            }
            <span>{{ isEdit ? 'Guardar' : 'Crear País' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .geo-form-dialog {
        padding: 8px;
        max-width: 720px;
      }
      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px 16px;
      }
      .dialog-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
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
        padding: 16px 0 4px;
      }
      .dialog-actions button {
        border-radius: 8px;
        height: 44px;
        padding: 0 24px;
      }
      .dialog-actions button[mat-flat-button] {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
})
export class CountryFormComponent {
  protected readonly data = inject<CountryFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly dialogRef = inject<MatDialogRef<CountryFormComponent, boolean>>(
    MatDialogRef<CountryFormComponent, boolean>,
  );
  private readonly fb = inject(FormBuilder);
  private readonly countryService = inject(CountryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly submitting = signal(false);
  protected readonly isEdit: boolean;
  protected form!: FormGroup;
  protected readonly localizedGroup = new FormGroup({});

  constructor() {
    const country = this.data?.country;
    this.isEdit = !!country;
    this.form = this.fb.group({
      countryCode: [country?.countryCode || '', Validators.required],
      countryName: [country?.countryName || '', Validators.required],
      countryContinent: [country?.countryContinent || ''],
      dialCode: [country?.dialCode || ''],
      status: [country?.status ?? true],
      localizedName: this.localizedGroup,
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);

    const value = this.form.value;
    const payload = {
      countryCode: String(value.countryCode || '').trim().toUpperCase(),
      countryName: value.countryName,
      countryContinent: value.countryContinent || undefined,
      dialCode: value.dialCode || undefined,
      status: !!value.status,
      localizedName: toLocalizedName(this.localizedGroup.getRawValue()),
    };

    const request$ = this.isEdit
      ? this.countryService.update(this.data.country!.id, payload)
      : this.countryService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'País actualizado correctamente' : 'País creado correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(true);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.snackBar.open(err?.message || 'Error al guardar el país', 'Cerrar', { duration: 5000 });
      },
    });
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
