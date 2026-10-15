import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize, forkJoin, Observable } from 'rxjs';

import { SettingsService } from '../../services/settings.service';
import {
  AppProperty,
  AppPropertyCategory,
  AppPropertyEnvironment,
} from '../../../../core/models/app-property.interface';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { environment as appEnvironment } from '../../../../../environments/environment';

const CATEGORY_LABELS: Record<AppPropertyCategory, string> = {
  APP: 'Aplicación',
  URL: 'URLs',
  API: 'APIs externas',
  VERSION: 'Versiones',
  SECURITY: 'Seguridad',
  ENV: 'Entorno',
  OTHER: 'Otros',
};

const ENVIRONMENTS: { value: AppPropertyEnvironment; label: string }[] = [
  { value: 'production', label: 'Producción' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'test', label: 'Pruebas' },
];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Configuración del Sistema</h1>
          <p class="page-subtitle">Propiedades de la aplicación guardadas en el backend (app_properties)</p>
        </div>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="env-select">
          <mat-label>Entorno</mat-label>
          <mat-select [value]="selectedEnvironment()" (selectionChange)="onEnvironmentChange($event.value)">
            @for (env of environments; track env.value) {
              <mat-option [value]="env.value">{{ env.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <app-loading-spinner [overlay]="false" message="Cargando configuración..."></app-loading-spinner>
      } @else if (categories().length === 0) {
        <mat-card class="settings-card">
          <mat-card-content>
            <p class="empty-tab">No hay propiedades para este entorno</p>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card class="settings-card">
          <mat-card-content>
            <form [formGroup]="form">
              <mat-tab-group animationDuration="200ms">
                @for (cat of categories(); track cat.category) {
                  <mat-tab [label]="cat.label + ' (' + cat.items.length + ')'">
                    <div class="tab-content">
                      @for (prop of cat.items; track prop.id) {
                        <div class="setting-card" [class.inactive]="!prop.isActive">
                          <div class="setting-header">
                            <span class="setting-key">{{ prop.key }}</span>
                            <span class="setting-type-badge">{{ prop.dataType }}</span>
                            @if (prop.isSecret) {
                              <span class="setting-type-badge badge-secret">Secreto</span>
                            }
                            @if (prop.isPublic) {
                              <span class="setting-type-badge badge-public">Público</span>
                            }
                            <span class="spacer"></span>
                            @if (editingId() !== prop.id) {
                              <button
                                mat-stroked-button
                                type="button"
                                class="edit-btn"
                                [disabled]="editingId() !== null || saving()"
                                (click)="startEdit(prop)"
                              >
                                <mat-icon>edit</mat-icon>
                                Editar
                              </button>
                            }
                            <mat-slide-toggle
                              color="primary"
                              [checked]="prop.isActive"
                              [disabled]="saving()"
                              (change)="toggleActive(prop, $event.checked)"
                            >
                              {{ prop.isActive ? 'Activa' : 'Inactiva' }}
                            </mat-slide-toggle>
                          </div>
                          @if (prop.description) {
                            <p class="setting-description">{{ prop.description }}</p>
                          }

                          @if (prop.dataType === 'BOOLEAN') {
                            <mat-slide-toggle [formControlName]="controlName(prop)" color="primary">
                              {{ form.get(controlName(prop))?.value ? 'Verdadero' : 'Falso' }}
                            </mat-slide-toggle>
                          } @else {
                            <mat-form-field appearance="outline" class="setting-input" subscriptSizing="dynamic">
                              <mat-label>Valor</mat-label>
                              @if (prop.dataType === 'JSON') {
                                <textarea matInput rows="4" [formControlName]="controlName(prop)"></textarea>
                              } @else if (prop.dataType === 'NUMBER') {
                                <input matInput type="number" [formControlName]="controlName(prop)" />
                              } @else if (prop.isSecret) {
                                <input
                                  matInput
                                  type="password"
                                  autocomplete="new-password"
                                  placeholder="Valor oculto"
                                  [formControlName]="controlName(prop)"
                                />
                              } @else {
                                <input matInput type="text" [formControlName]="controlName(prop)" />
                              }
                            </mat-form-field>
                          }

                          @if (editingId() === prop.id) {
                            <div class="row-actions">
                              @if (prop.isSecret) {
                                <span class="row-hint">Escriba el nuevo valor secreto; el actual no se muestra.</span>
                              }
                              <button mat-stroked-button type="button" [disabled]="saving()" (click)="cancelEdit(prop)">
                                Cancelar
                              </button>
                              <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="saveRow(prop)">
                                @if (saving()) {
                                  <mat-spinner [diameter]="18"></mat-spinner>
                                } @else {
                                  <mat-icon>save</mat-icon>
                                }
                                Guardar
                              </button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </mat-tab>
                }
              </mat-tab-group>

            </form>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .settings-page {
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
      }

      .page-header {
        margin-bottom: 24px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .page-title {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.2;
      }

      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: #94a3b8;
        font-weight: 400;
      }

      .env-select {
        width: 200px;
      }

      .settings-card {
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

        ::ng-deep .mat-mdc-card-content {
          padding: 0;
        }

        ::ng-deep .mat-mdc-tab-header {
          background: #f8fafc;
          border-radius: 12px 12px 0 0;
          border-bottom: 1px solid #e2e8f0;
        }
      }

      .tab-content {
        padding: 8px 24px 24px;
        min-height: 300px;
      }

      .empty-tab {
        text-align: center;
        color: #94a3b8;
        font-size: 14px;
        padding: 48px 0;
        margin: 0;
      }

      .setting-card {
        padding: 20px 0;
        border-bottom: 1px solid #f1f5f9;

        &:last-of-type {
          border-bottom: none;
        }

        &.inactive {
          opacity: 0.6;
        }
      }

      .setting-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }

      .edit-btn {
        border-radius: 10px;
        height: 32px;
        padding: 0 12px;
        font-size: 13px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .row-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 10px;
        flex-wrap: wrap;

        button {
          border-radius: 10px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      }

      .row-hint {
        margin-right: auto;
        font-size: 12px;
        color: var(--fac-text-muted);
      }

      .spacer {
        flex: 1;
      }

      .setting-key {
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        word-break: break-all;
      }

      .setting-type-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        color: #009bff;
        background: #e8f7ff;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .badge-secret {
        color: #b91c1c;
        background: #fee2e2;
      }

      .badge-public {
        color: #047857;
        background: #d1fae5;
      }

      .setting-description {
        margin: 0 0 12px;
        font-size: 13px;
        color: #94a3b8;
      }

      .setting-input {
        width: 100%;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px 24px;
        border-top: 1px solid #f1f5f9;

        button {
          border-radius: 8px;
          font-weight: 600;
          height: 44px;
          padding: 0 24px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly environments = ENVIRONMENTS;
  protected readonly selectedEnvironment = signal<AppPropertyEnvironment>(
    appEnvironment.production ? 'production' : 'development',
  );
  protected readonly properties = signal<AppProperty[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  /** Propiedad cuyo valor esta desbloqueado para editar (una a la vez). */
  protected readonly editingId = signal<number | null>(null);
  protected form: FormGroup = this.fb.group({});

  /** Una pestaña por categoría que tenga propiedades, en el orden de CATEGORY_LABELS. */
  protected readonly categories = computed(() =>
    (Object.keys(CATEGORY_LABELS) as AppPropertyCategory[])
      .map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        items: this.properties().filter((p) => p.category === category),
      }))
      .filter((c) => c.items.length > 0),
  );

  ngOnInit(): void {
    this.load();
  }

  protected controlName(prop: AppProperty): string {
    return `p${prop.id}`;
  }

  protected onEnvironmentChange(env: AppPropertyEnvironment): void {
    this.selectedEnvironment.set(env);
    this.load();
  }

  protected load(): void {
    this.editingId.set(null);
    this.loading.set(true);
    this.settingsService
      .getAll(this.selectedEnvironment())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const items = res.data ?? [];
          this.form = this.fb.group(
            Object.fromEntries(items.map((p) => [this.controlName(p), new FormControl({ value: this.toFormValue(p), disabled: true })])),
          );
          this.properties.set(items);
        },
        error: () => {
          this.properties.set([]);
          this.snackBar.open('Error al cargar la configuración', 'Cerrar', { duration: 5000 });
        },
      });
  }

  /** Desbloquea el valor de una propiedad; las demas siguen deshabilitadas. */
  protected startEdit(prop: AppProperty): void {
    const control = this.form.get(this.controlName(prop));
    if (!control) return;
    // Un secreto no se muestra: se escribe uno nuevo desde cero.
    if (prop.isSecret) control.setValue('');
    control.enable();
    this.editingId.set(prop.id);
  }

  protected cancelEdit(prop: AppProperty): void {
    const control = this.form.get(this.controlName(prop));
    control?.setValue(this.toFormValue(prop));
    control?.disable();
    this.editingId.set(null);
  }

  protected saveRow(prop: AppProperty): void {
    const control = this.form.get(this.controlName(prop));
    if (!control) return;

    const value = this.toApiValue(prop, control.value);
    if (value === null) {
      this.snackBar.open(`El valor de ${prop.key} no es un JSON válido`, 'Cerrar', { duration: 5000 });
      return;
    }
    if (prop.isSecret && value === '') {
      this.snackBar.open('Escriba el nuevo valor o cancele', 'Cerrar', { duration: 4000 });
      return;
    }

    this.saving.set(true);
    this.settingsService
      .update(prop.id, { value })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const saved = res.data ?? { ...prop, value };
          this.properties.update((list) => list.map((p) => (p.id === prop.id ? { ...p, value: saved.value } : p)));
          control.setValue(this.toFormValue({ ...prop, value: saved.value }));
          control.disable();
          this.editingId.set(null);
          this.snackBar.open(`${prop.key} guardada`, 'Cerrar', { duration: 3000 });
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo guardar el valor', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected toggleActive(prop: AppProperty, isActive: boolean): void {
    this.settingsService
      .update(prop.id, { isActive })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.properties.update((list) => list.map((p) => (p.id === prop.id ? { ...p, isActive } : p)));
          this.snackBar.open(`${prop.key} ${isActive ? 'activada' : 'desactivada'}`, 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('No se pudo cambiar el estado', 'Cerrar', { duration: 5000 });
          this.load();
        },
      });
  }

  private toFormValue(prop: AppProperty): unknown {
    // Los secretos llegan enmascarados ('***'): se muestran como puntos, sin el valor real.
    if (prop.isSecret) return '••••••••';
    switch (prop.dataType) {
      case 'BOOLEAN':
        return prop.value === true || prop.value === 'true';
      case 'NUMBER':
        return prop.value ?? 0;
      case 'JSON':
        return typeof prop.value === 'string' ? prop.value : JSON.stringify(prop.value ?? null, null, 2);
      default:
        return prop.value ?? '';
    }
  }

  /** UpdateAppPropertyDto.value es string; null = JSON invalido. */
  private toApiValue(prop: AppProperty, raw: unknown): string | null {
    if (prop.dataType === 'BOOLEAN') return raw ? 'true' : 'false';
    if (prop.dataType === 'JSON') {
      try {
        JSON.parse(String(raw));
      } catch {
        return null;
      }
    }
    return String(raw ?? '');
  }
}
