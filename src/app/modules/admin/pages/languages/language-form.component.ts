import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { LanguageService } from '../../services/language.service';
import { Language, SaveLanguage } from '../../../../core/models/language.interface';
import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';

export interface LanguageFormData {
  language?: Language;
}

@Component({
  selector: 'app-language-form',
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
    <div class="form-dialog">
      <div class="dialog-header">
        <h2>{{ isEdit ? 'Editar idioma' : 'Nuevo idioma' }}</h2>
        <button mat-icon-button type="button" (click)="dialogRef.close(false)">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="dialog-body">
        <div class="grid-3">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Código</mat-label>
            <input matInput formControlName="code" placeholder="Ej: pt" maxlength="5" autocomplete="off" />
            <mat-hint>ISO de 2 letras (es, en, pt…)</mat-hint>
            @if (form.get('code')?.hasError('pattern')) {
              <mat-error>Use 2 letras, opcionalmente región: pt o pt-br</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Nombre en su idioma</mat-label>
            <input matInput formControlName="name" placeholder="Ej: Português" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Bandera (emoji)</mat-label>
            <input matInput formControlName="flag" placeholder="🇧🇷" maxlength="16" />
          </mat-form-field>
        </div>

        <div class="grid-3">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Orden</mat-label>
            <input matInput type="number" formControlName="sortOrder" />
          </mat-form-field>
          <mat-slide-toggle formControlName="isActive" color="primary">Activo en la app</mat-slide-toggle>
          <mat-slide-toggle formControlName="isDefault" color="primary">Idioma por defecto</mat-slide-toggle>
        </div>

        <app-localized-name-fields
          [group]="localizedGroup"
          [initial]="data.language?.localizedName"
          title="Nombre del idioma en cada idioma"
        />

        @if (!isEdit) {
          <p class="note">
            <mat-icon>info</mat-icon>
            Al crearlo y activarlo aparece en el selector de la app y como campo en las traducciones de países,
            departamentos y ciudades. Los textos fijos de la app (botones, menús) siguen en los archivos de traducción
            de la app; sin archivo para este idioma, la app usa español.
          </p>
        }

        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="submitting()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
            @if (submitting()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon>
            }
            <span>{{ isEdit ? 'Guardar' : 'Crear idioma' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .form-dialog { padding: 8px; max-width: 760px; }
      .dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 0 8px 12px; }
      .dialog-header h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
      .dialog-body { padding: 8px; display: flex; flex-direction: column; gap: 12px; }
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: center; }
      .grid-3 mat-form-field { width: 100%; }
      .note {
        display: flex; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px;
        background: var(--fac-primary-soft); color: #33556b; font-size: 13px; line-height: 1.4;
        mat-icon { color: var(--fac-primary-shade); flex-shrink: 0; font-size: 20px; width: 20px; height: 20px; }
      }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding-top: 8px;
        button { border-radius: 10px; height: 44px; padding: 0 24px; display: inline-flex; align-items: center; gap: 8px; }
      }
      @media (max-width: 640px) { .grid-3 { grid-template-columns: 1fr; } }
    `,
  ],
})
export class LanguageFormComponent {
  protected readonly data: LanguageFormData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly dialogRef = inject(MatDialogRef<LanguageFormComponent, boolean>);
  private readonly fb = inject(FormBuilder);
  private readonly languageService = inject(LanguageService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.language;
  protected readonly submitting = signal(false);
  protected readonly localizedGroup = new FormGroup({});

  protected readonly form = this.fb.group({
    // El codigo es la clave de las traducciones guardadas: no se cambia al editar.
    code: [
      { value: this.data.language?.code ?? '', disabled: this.isEdit },
      [Validators.required, Validators.pattern(/^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/)],
    ],
    name: [this.data.language?.name ?? '', [Validators.required, Validators.maxLength(60)]],
    flag: [this.data.language?.flag ?? ''],
    sortOrder: [this.data.language?.sortOrder ?? 0],
    isActive: [this.data.language?.isActive ?? true],
    isDefault: [this.data.language?.isDefault ?? false],
    localizedName: this.localizedGroup,
  });

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    if (v.isDefault && !v.isActive) {
      this.snackBar.open('El idioma por defecto debe estar activo', 'Cerrar', { duration: 4000 });
      return;
    }

    const payload: SaveLanguage = {
      name: String(v.name).trim(),
      flag: v.flag?.trim() || null,
      sortOrder: Number(v.sortOrder) || 0,
      isActive: !!v.isActive,
      isDefault: !!v.isDefault,
      localizedName: toLocalizedName(this.localizedGroup.getRawValue()),
    };
    if (!this.isEdit) payload.code = String(v.code).trim().toLowerCase();

    this.submitting.set(true);
    const request$ = this.isEdit
      ? this.languageService.update(this.data.language!.id, payload)
      : this.languageService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(this.isEdit ? 'Idioma actualizado' : 'Idioma creado', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.snackBar.open(err?.message || 'No se pudo guardar el idioma', 'Cerrar', { duration: 5000 });
      },
    });
  }
}
