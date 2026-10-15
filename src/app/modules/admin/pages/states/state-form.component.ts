import {
  Component,
  OnInit,
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
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { StateService } from '../../services/state.service';
import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import { CountryService } from '../../services/country.service';
import { StateCountry } from '../../../../core/models/state.interface';
import { Country } from '../../../../core/models/country.interface';

export interface StateFormData {
  state?: StateCountry;
}

@Component({
  selector: 'app-state-form',
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
    MatProgressSpinnerModule,
    MatSnackBarModule,
    LocalizedNameFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="geo-form-dialog">
      <div class="dialog-header">
        <h2>{{ isEdit ? 'Editar Departamento' : 'Nuevo Departamento' }}</h2>
        <button mat-icon-button type="button" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>País</mat-label>
          <mat-select formControlName="countryCode">
            <mat-option [value]="null" disabled>Seleccione un país</mat-option>
            @for (country of countries(); track country.countryCode) {
              <mat-option [value]="country.countryCode">{{ country.countryName }} ({{ country.countryCode }})</mat-option>
            }
          </mat-select>
          @if (form.get('countryCode')?.hasError('required') && form.get('countryCode')?.touched) {
            <mat-error>El país es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Código</mat-label>
          <input matInput formControlName="stateCode" placeholder="Ej: ANT" />
          @if (form.get('stateCode')?.hasError('required') && form.get('stateCode')?.touched) {
            <mat-error>El código es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nombre del departamento</mat-label>
          <input matInput formControlName="stateName" placeholder="Ej: Antioquia" />
          @if (form.get('stateName')?.hasError('required') && form.get('stateName')?.touched) {
            <mat-error>El nombre es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Región</mat-label>
          <input matInput formControlName="regionState" placeholder="Ej: Andina" />
        </mat-form-field>

        <app-localized-name-fields [group]="localizedGroup" [initial]="data.state?.localizedName" />

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
            <span>{{ isEdit ? 'Guardar' : 'Crear Departamento' }}</span>
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
export class StateFormComponent implements OnInit {
  protected readonly data = inject<StateFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly dialogRef = inject<MatDialogRef<StateFormComponent, boolean>>(
    MatDialogRef<StateFormComponent, boolean>,
  );
  private readonly fb = inject(FormBuilder);
  private readonly stateService = inject(StateService);
  private readonly countryService = inject(CountryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly countries = signal<Country[]>([]);
  protected readonly isEdit: boolean;
  protected readonly submitting = signal(false);
  protected form!: FormGroup;
  protected readonly localizedGroup = new FormGroup({});

  constructor() {
    const state = this.data?.state;
    this.isEdit = !!state;
    this.form = this.fb.group({
      countryCode: [state?.countryCode || null, Validators.required],
      stateCode: [state?.stateCode || '', Validators.required],
      stateName: [state?.stateName || '', Validators.required],
      regionState: [state?.regionState || ''],
      localizedName: this.localizedGroup,
    });
  }

  ngOnInit(): void {
    this.countryService
      .getAll({ page: 1, limit: 300, sortBy: 'countryName', sortOrder: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.countries.set(res?.items ?? []),
        error: () => this.snackBar.open('Error al cargar países', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);

    const value = this.form.value;
    const payload = {
      stateCode: value.stateCode,
      stateName: value.stateName,
      regionState: value.regionState || undefined,
      countryCode: value.countryCode,
      localizedName: toLocalizedName(this.localizedGroup.getRawValue()),
    };

    const request$ = this.isEdit
      ? this.stateService.update(this.data.state!.id, payload)
      : this.stateService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Departamento actualizado correctamente' : 'Departamento creado correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(true);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.snackBar.open(err?.message || 'Error al guardar el departamento', 'Cerrar', { duration: 5000 });
      },
    });
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
