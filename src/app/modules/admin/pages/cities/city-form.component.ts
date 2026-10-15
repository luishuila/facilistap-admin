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
import { finalize } from 'rxjs';

import { CityService } from '../../services/city.service';
import { CountryService } from '../../services/country.service';
import { StateService } from '../../services/state.service';
import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import { City } from '../../../../core/models/city.interface';
import { Country } from '../../../../core/models/country.interface';
import { StateCountry } from '../../../../core/models/state.interface';

export interface CityFormData {
  city?: City;
  /** Pais/departamento preseleccionados al crear (los filtros activos del listado). */
  countryCode?: string | null;
  stateCode?: string | null;
}

@Component({
  selector: 'app-city-form',
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
        <h2>{{ isEdit ? 'Editar Ciudad' : 'Nueva Ciudad' }}</h2>
        <button mat-icon-button type="button" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <div class="two-cols">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>País</mat-label>
            <mat-select formControlName="countryCode" (selectionChange)="onCountryChange($event.value)">
              @for (country of countries(); track country.id) {
                <mat-option [value]="country.countryCode">{{ country.countryName }} ({{ country.countryCode }})</mat-option>
              }
            </mat-select>
            @if (form.get('countryCode')?.hasError('required') && form.get('countryCode')?.touched) {
              <mat-error>Seleccione el país</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Departamento</mat-label>
            <mat-select formControlName="stateCode">
              @for (state of states(); track state.id) {
                <mat-option [value]="state.stateCode">{{ state.stateName }} ({{ state.stateCode }})</mat-option>
              }
            </mat-select>
            @if (statesLoading()) {
              <mat-spinner matSuffix diameter="18"></mat-spinner>
            }
            @if (!form.value.countryCode) {
              <mat-hint>Elija primero el país</mat-hint>
            } @else if (!statesLoading() && states().length === 0) {
              <mat-hint>Este país no tiene departamentos</mat-hint>
            }
            @if (form.get('stateCode')?.hasError('required') && form.get('stateCode')?.touched) {
              <mat-error>Seleccione el departamento</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nombre de la ciudad</mat-label>
          <input matInput formControlName="cityName" placeholder="Ej: Medellín" />
          @if (form.get('cityName')?.hasError('required') && form.get('cityName')?.touched) {
            <mat-error>El nombre es requerido</mat-error>
          }
        </mat-form-field>

        <app-localized-name-fields [group]="localizedGroup" [initial]="data.city?.localizedName" />

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
            <span>{{ isEdit ? 'Guardar' : 'Crear Ciudad' }}</span>
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
        color: var(--fac-text);
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
      .two-cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
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
      @media (max-width: 560px) {
        .two-cols {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CityFormComponent implements OnInit {
  protected readonly data = inject<CityFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly dialogRef = inject<MatDialogRef<CityFormComponent, boolean>>(
    MatDialogRef<CityFormComponent, boolean>,
  );
  private readonly fb = inject(FormBuilder);
  private readonly cityService = inject(CityService);
  private readonly countryService = inject(CountryService);
  private readonly stateService = inject(StateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly countries = signal<Country[]>([]);
  protected readonly states = signal<StateCountry[]>([]);
  protected readonly statesLoading = signal(false);
  protected readonly isEdit: boolean;
  protected readonly submitting = signal(false);
  protected form!: FormGroup;
  protected readonly localizedGroup = new FormGroup({});

  constructor() {
    const city = this.data?.city;
    this.isEdit = !!city;
    this.form = this.fb.group({
      countryCode: [null as string | null, Validators.required],
      // El departamento se habilita al elegir pais.
      stateCode: [{ value: null as string | null, disabled: true }, Validators.required],
      cityName: [city?.cityName || '', Validators.required],
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

    const city = this.data.city;
    if (city) {
      // La ciudad se une a su departamento por `stateCode`; el listado ya trae su pais.
      if (city.countryCode) {
        this.selectCountry(city.countryCode, city.stateCode);
      } else if (city.stateCode) {
        this.stateService
          .getAll({ page: 1, limit: 1, filters: { stateCode: city.stateCode } })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              const state = res?.items?.[0];
              if (state?.countryCode) this.selectCountry(state.countryCode, state.stateCode);
            },
          });
      }
    } else if (this.data.countryCode) {
      this.selectCountry(this.data.countryCode, this.data.stateCode ?? null);
    }
  }

  protected onCountryChange(countryCode: string): void {
    this.form.patchValue({ stateCode: null });
    this.loadStates(countryCode);
  }

  private selectCountry(countryCode: string, stateCode: string | null): void {
    this.form.patchValue({ countryCode });
    this.loadStates(countryCode, stateCode);
  }

  private loadStates(countryCode: string, selectStateCode: string | null = null): void {
    const stateControl = this.form.get('stateCode')!;
    stateControl.disable();
    this.states.set([]);
    this.statesLoading.set(true);
    this.stateService
      .getAll({ page: 1, limit: 500, sortBy: 'stateName', sortOrder: 'asc', filters: { countryCode } })
      .pipe(
        finalize(() => this.statesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const states = res?.items ?? [];
          this.states.set(states);
          if (states.length) stateControl.enable();
          if (selectStateCode && states.some((s) => s.stateCode === selectStateCode)) {
            stateControl.setValue(selectStateCode);
          }
        },
        error: () => this.snackBar.open('Error al cargar departamentos', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;

    const value = this.form.getRawValue();
    const state = this.states().find((s) => s.stateCode === value.stateCode);
    if (!state) {
      this.snackBar.open('Seleccione el departamento', 'Cerrar', { duration: 4000 });
      return;
    }
    this.submitting.set(true);

    // El DTO del backend exige cityName, stateCode y stateCountryId.
    const payload = {
      cityName: value.cityName,
      stateCode: state.stateCode,
      stateCountryId: Number(state.id),
      localizedName: toLocalizedName(this.localizedGroup.getRawValue()),
    };

    const request$ = this.isEdit
      ? this.cityService.update(this.data.city!.id, payload)
      : this.cityService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Ciudad actualizada correctamente' : 'Ciudad creada correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(true);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.snackBar.open(err?.message || 'Error al guardar la ciudad', 'Cerrar', { duration: 5000 });
      },
    });
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
