import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LanguageService } from '../../../modules/admin/services/language.service';
import { LocalizedName } from '../../../core/models/language.interface';

export { toLocalizedName, translationsLabel } from '../../../core/utils/localized-name.util';

interface LanguageField {
  code: string;
  label: string;
  flag: string | null;
  rtl: boolean;
  /** Idioma guardado en el registro pero ya no activo en la tabla `languages`. */
  inactive: boolean;
}

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Un campo por cada idioma activo (tabla `languages`) para editar un `localized_name`.
 * Si se agrega un idioma en Idiomas, aparece aqui sin tocar codigo.
 * Uso: <app-localized-name-fields [group]="form.controls.localizedName" [initial]="pais.localizedName" />
 */
@Component({
  selector: 'app-localized-name-fields',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="i18n-section">
      <div class="i18n-header">
        <mat-icon>translate</mat-icon>
        <span class="i18n-title">{{ title }}</span>
        <span class="i18n-hint">Los idiomas vacíos usan el nombre principal</span>
      </div>

      @if (loading()) {
        <div class="i18n-loading"><mat-spinner diameter="22"></mat-spinner></div>
      } @else {
        <div class="i18n-grid" [formGroup]="group">
          @for (f of fields(); track f.code) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ f.flag ? f.flag + ' ' : '' }}{{ f.label }} ({{ f.code }}){{ f.inactive ? ' · inactivo' : '' }}</mat-label>
              <input matInput [formControlName]="f.code" [attr.dir]="f.rtl ? 'rtl' : null" autocomplete="off" />
            </mat-form-field>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .i18n-section {
        border: 1px solid var(--fac-border, #ececf1);
        border-radius: 12px;
        padding: 12px 14px 4px;
        margin: 4px 0 8px;
        background: #fbfcfe;
      }
      .i18n-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
        mat-icon { color: var(--fac-primary-shade, #009bff); font-size: 20px; width: 20px; height: 20px; }
      }
      .i18n-title { font-weight: 600; color: var(--fac-text, #222); font-size: 14px; }
      .i18n-hint { font-size: 12px; color: var(--fac-text-muted, #6b6b6b); margin-left: auto; }
      .i18n-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px 12px; }
      .i18n-grid mat-form-field { width: 100%; }
      .i18n-loading { display: flex; justify-content: center; padding: 12px; }
    `,
  ],
})
export class LocalizedNameFieldsComponent implements OnInit {
  /** FormGroup donde se agrega un control por idioma (clave = codigo). */
  @Input({ required: true }) group!: FormGroup;
  /** Traducciones ya guardadas (localized_name del registro). */
  @Input() initial: LocalizedName | null | undefined = null;
  @Input() title = 'Nombre en cada idioma';

  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly fields = signal<LanguageField[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.languageService
      .getActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (langs) => this.build(langs.map((l) => ({ code: l.code, label: l.label || l.name, flag: l.flag }))),
        error: () => this.build([]),
      });
  }

  private build(active: { code: string; label: string; flag: string | null }[]): void {
    const initial = this.initial ?? {};
    const activeCodes = new Set(active.map((l) => l.code));
    // Traducciones guardadas de idiomas que hoy no estan activos: se muestran para no perderlas.
    const extra = Object.keys(initial)
      .filter((code) => !activeCodes.has(code))
      .map((code) => ({ code, label: code.toUpperCase(), flag: null }));

    const fields: LanguageField[] = [...active, ...extra].map((l) => ({
      ...l,
      rtl: RTL_LANGS.has(l.code),
      inactive: !activeCodes.has(l.code),
    }));

    for (const f of fields) {
      if (!this.group.contains(f.code)) {
        this.group.addControl(f.code, new FormControl<string>(initial[f.code] ?? '', { nonNullable: true }));
      }
    }
    this.fields.set(fields);
    this.loading.set(false);
  }
}
