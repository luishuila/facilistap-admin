import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import {
  MaestraGroup,
  MaestraItem,
  MaestraService,
  SaveMaestra,
  metadataValue,
  toValueMetadata,
} from '../../services/maestra.service';

/** Grupos cuyo metadata es solo un valor ({ "value": ... }): se editan con un campo simple. */
const VALUE_GROUPS = ['SUBSCRIPTION'];

function jsonValidator(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  try {
    JSON.parse(v);
    return null;
  } catch {
    return { json: true };
  }
}

export interface MaestraFormData {
  item?: MaestraItem;
  groups: MaestraGroup[];
  /** Grupo preseleccionado al crear (el del filtro de la lista). */
  groupName?: string | null;
}

@Component({
  selector: 'app-maestra-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    LocalizedNameFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>{{ isEdit ? 'edit_note' : 'playlist_add' }}</mat-icon></div>
        <div>
          <h2>{{ isEdit ? 'Editar valor' : 'Nuevo valor' }}</h2>
          <p>Tabla maestra: catálogos que usa la app en sus listas y selectores.</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="body">
        <div class="grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
            <mat-label>Grupo</mat-label>
            <mat-select formControlName="groupName">
              @for (g of data.groups; track g.code) {
                <mat-option [value]="g.code">{{ g.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Código</mat-label>
            <input matInput formControlName="code" placeholder="TARJETA_IDENTIDAD" autocomplete="off" (input)="upperCode()" />
            @if (isEdit) {
              <mat-hint>No se cambia: la app lo usa como identificador.</mat-hint>
            }
            @if (form.get('code')?.hasError('pattern')) {
              <mat-error>Solo MAYÚSCULAS, números y _</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Orden</mat-label>
            <input matInput type="number" min="0" formControlName="sortOrder" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
            <mat-label>Nombre (por defecto, español)</mat-label>
            <input matInput formControlName="name" autocomplete="off" />
          </mat-form-field>
          @if (valueMode) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
              <mat-label>Valor</mat-label>
              <input matInput formControlName="value" autocomplete="off" />
              <mat-hint>Número, texto o fecha (ISO). Se guarda en metadata como {{ '{' }} "value": ... {{ '}' }}</mat-hint>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
              <mat-label>Datos adicionales (JSON, opcional)</mat-label>
              <textarea matInput formControlName="metadata" rows="3" class="mono"></textarea>
              @if (form.get('metadata')?.hasError('json')) {
                <mat-error>JSON inválido</mat-error>
              }
            </mat-form-field>
          }
        </div>

        <app-localized-name-fields [group]="localizedGroup" [initial]="data.item?.localizedName" />

        <mat-slide-toggle color="primary" formControlName="isActive">Activo (se muestra en la app)</mat-slide-toggle>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="saving()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
            @if (saving()) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>save</mat-icon>
            }
            {{ isEdit ? 'Guardar cambios' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .dialog { padding: 8px 16px; max-width: 720px; }
      .dialog-header { display: flex; gap: 14px; align-items: flex-start; padding: 4px 0 16px;
        h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .header-icon { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; background: var(--fac-gradient);
        display: flex; align-items: center; justify-content: center; mat-icon { color: #fff; } }
      .body { display: flex; flex-direction: column; gap: 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; mat-form-field { width: 100%; } }
      .span-2 { grid-column: 1 / -1; }
      .mono { font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
      .actions { display: flex; justify-content: flex-end; gap: 12px; padding-bottom: 8px;
        button { border-radius: 10px; height: 44px; padding: 0 22px; display: inline-flex; align-items: center; gap: 6px; } }
      @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    `,
  ],
})
export class MaestraFormComponent {
  protected readonly data: MaestraFormData = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<MaestraFormComponent, boolean>);
  private readonly service = inject(MaestraService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.item;
  protected readonly saving = signal(false);
  protected readonly localizedGroup = new FormGroup({});

  protected readonly form = this.fb.group({
    groupName: [this.data.item?.groupName ?? this.data.groupName ?? '', Validators.required],
    code: [this.data.item?.code ?? '', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: [this.data.item?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    sortOrder: [this.data.item?.sortOrder ?? 0, [Validators.min(0)]],
    isActive: [this.data.item?.isActive ?? true],
    value: [metadataValue(this.data.item?.metadata) ?? ''],
    metadata: [this.data.item?.metadata ?? '', [jsonValidator]],
  });

  /** Metadata de un solo valor: los grupos de VALUE_GROUPS o un item que ya lo trae así. */
  protected get valueMode(): boolean {
    if (this.isEdit && this.data.item?.metadata) return metadataValue(this.data.item.metadata) !== undefined;
    return VALUE_GROUPS.includes(this.form.controls.groupName.value ?? '');
  }

  constructor() {
    // Grupo y codigo identifican el valor en la app: no se cambian al editar.
    if (this.isEdit) {
      this.form.controls.groupName.disable();
      this.form.controls.code.disable();
    }
  }

  protected upperCode(): void {
    const c = this.form.controls.code;
    const v = (c.value ?? '').toUpperCase().replace(/\s+/g, '_');
    if (v !== c.value) c.setValue(v, { emitEvent: false });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const payload: SaveMaestra = {
      name: v.name!.trim(),
      sortOrder: Number(v.sortOrder ?? 0),
      isActive: !!v.isActive,
      localizedName: toLocalizedName(this.localizedGroup.getRawValue()) ?? {},
    };
    if (this.valueMode) {
      payload.metadata = toValueMetadata(v.value ?? '');
    } else {
      const json = (v.metadata ?? '').trim();
      // Vacío: solo se manda si había algo, para borrarlo.
      if (json || this.data.item?.metadata) payload.metadata = json;
    }
    if (!this.isEdit) {
      payload.groupName = v.groupName!;
      payload.code = v.code!.trim();
    }

    this.saving.set(true);
    const request$ = this.isEdit ? this.service.update(this.data.item!.id, payload) : this.service.create(payload);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(this.isEdit ? 'Valor actualizado' : 'Valor creado', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar', 'Cerrar', { duration: 5000 }),
      });
  }
}
