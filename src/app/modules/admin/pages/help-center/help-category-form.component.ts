import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import { HelpCategoryAdmin, HelpCenterAdminService, SaveHelpCategory } from '../../services/help-center.service';

export interface HelpCategoryFormData {
  category?: HelpCategoryAdmin;
  nextOrder?: number;
}

/** Íconos de Ionicons que suelen servir para un tema de ayuda (la app los pinta). */
const SUGGESTED_ICONS = [
  'rocket-outline', 'calendar-outline', 'wallet-outline', 'storefront-outline', 'people-outline',
  'shield-checkmark-outline', 'chatbubbles-outline', 'card-outline', 'notifications-outline',
  'location-outline', 'star-outline', 'gift-outline', 'cut-outline', 'restaurant-outline', 'settings-outline',
];

@Component({
  selector: 'app-help-category-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    LocalizedNameFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>{{ isEdit ? 'edit' : 'create_new_folder' }}</mat-icon></div>
        <div class="header-text">
          <h2>{{ isEdit ? 'Editar tema' : 'Nuevo tema de ayuda' }}</h2>
          <p>Los temas agrupan los artículos en la portada del Centro de ayuda de la app.</p>
        </div>
        <button mat-icon-button type="button" class="close" (click)="dialogRef.close(false)" [disabled]="saving()" aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="body" id="helpCategoryForm">
        <section class="block">
          <div class="block-title"><span class="num">1</span> Identificación</div>
          <div class="grid">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Código</mat-label>
              <input matInput formControlName="code" placeholder="PAGOS" autocomplete="off" (input)="upperCode()" />
              <mat-hint>{{ isEdit ? 'No se cambia (identificador).' : 'MAYÚSCULAS y _ (ej. PAGOS)' }}</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Orden</mat-label>
              <input matInput type="number" formControlName="sortOrder" />
              <mat-hint>Menor = más arriba en la portada</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
              <mat-label>Ícono (Ionicons)</mat-label>
              <input matInput formControlName="icon" placeholder="calendar-outline" autocomplete="off" />
              <mat-hint><a href="https://ionic.io/ionicons" target="_blank" rel="noopener">Ver íconos disponibles</a> · la app lo pinta en azul</mat-hint>
            </mat-form-field>
          </div>
          <mat-chip-set class="icons" aria-label="Íconos sugeridos">
            @for (icon of suggestedIcons; track icon) {
              <mat-chip [highlighted]="form.controls.icon.value === icon" (click)="form.controls.icon.setValue(icon)">{{ icon }}</mat-chip>
            }
          </mat-chip-set>
        </section>

        <section class="block">
          <div class="block-title"><span class="num">2</span> Nombre y descripción <small>El español es obligatorio; los idiomas vacíos lo usan</small></div>
          <app-localized-name-fields [group]="nameGroup" [initial]="data.category?.name" title="Nombre del tema" />
          <app-localized-name-fields [group]="descriptionGroup" [initial]="data.category?.description" title="Frase corta debajo del nombre" />
        </section>

        <mat-slide-toggle color="primary" formControlName="isActive">Activo (se muestra en la app)</mat-slide-toggle>
      </form>

      <div class="actions">
        <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="saving()">Cancelar</button>
        <button mat-flat-button color="primary" type="submit" form="helpCategoryForm" [disabled]="form.invalid || saving()">
          @if (saving()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          {{ isEdit ? 'Guardar cambios' : 'Crear tema' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog { max-width: 760px; }
      .dialog-header { position: sticky; top: 0; z-index: 3; display: flex; gap: 14px; align-items: flex-start;
        padding: 18px 20px 14px; background: var(--fac-surface, #fff); border-bottom: 1px solid var(--fac-border);
        h2 { margin: 0; font-size: 19px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .header-text { flex: 1; min-width: 0; }
      .close { margin: -6px -8px 0 0; }
      .header-icon { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; background: var(--fac-gradient);
        display: flex; align-items: center; justify-content: center; mat-icon { color: #fff; } }
      .body { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }
      .block { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--fac-border); border-radius: 14px; background: #fcfdff; }
      .block-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--fac-text); flex-wrap: wrap;
        small { font-weight: 400; color: var(--fac-text-muted); font-size: 12px; } }
      .num { width: 22px; height: 22px; border-radius: 50%; background: var(--fac-gradient); color: #fff; font-size: 12px;
        display: inline-flex; align-items: center; justify-content: center; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; mat-form-field { width: 100%; } }
      .span-2 { grid-column: 1 / -1; }
      .icons { display: block; }
      a { color: var(--fac-primary-deep, #0078ff); }
      .actions { position: sticky; bottom: 0; z-index: 3; display: flex; justify-content: flex-end; gap: 12px;
        padding: 12px 20px; background: var(--fac-surface, #fff); border-top: 1px solid var(--fac-border);
        button { border-radius: 10px; height: 44px; padding: 0 22px; display: inline-flex; align-items: center; gap: 6px; } }
      @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } .body { padding: 12px; } }
    `,
  ],
})
export class HelpCategoryFormComponent {
  protected readonly data: HelpCategoryFormData = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<HelpCategoryFormComponent, boolean>);
  private readonly service = inject(HelpCenterAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.category;
  protected readonly saving = signal(false);
  protected readonly suggestedIcons = SUGGESTED_ICONS;
  protected readonly nameGroup = new FormGroup({});
  protected readonly descriptionGroup = new FormGroup({});

  protected readonly form = this.fb.nonNullable.group({
    code: [this.data.category?.code ?? '', [Validators.required, Validators.pattern(/^[A-Z0-9_]{2,60}$/)]],
    icon: [this.data.category?.icon ?? 'help-circle-outline', [Validators.required, Validators.pattern(/^[a-z0-9-]{2,60}$/)]],
    sortOrder: [this.data.category?.sortOrder ?? this.data.nextOrder ?? 10],
    isActive: [this.data.category?.isActive ?? true],
  });

  constructor() {
    if (this.isEdit) this.form.controls.code.disable();
  }

  protected upperCode(): void {
    const control = this.form.controls.code;
    const value = (control.value ?? '').toUpperCase().replace(/\s+/g, '_');
    if (value !== control.value) control.setValue(value, { emitEvent: false });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const name = toLocalizedName(this.nameGroup.getRawValue());
    if (!name?.['es']) {
      this.snackBar.open('Escriba el nombre del tema al menos en español.', 'Cerrar', { duration: 5000 });
      return;
    }
    const value = this.form.getRawValue();
    const payload: SaveHelpCategory = {
      name,
      description: toLocalizedName(this.descriptionGroup.getRawValue()),
      icon: value.icon.trim(),
      sortOrder: Number(value.sortOrder) || 0,
      isActive: value.isActive,
    };
    if (!this.isEdit) payload.code = value.code.trim();

    this.saving.set(true);
    const request$ = this.isEdit
      ? this.service.updateCategory(this.data.category!.id, payload)
      : this.service.createCategory(payload);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(this.isEdit ? 'Tema actualizado' : 'Tema creado', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar el tema', 'Cerrar', { duration: 5000 }),
      });
  }
}
