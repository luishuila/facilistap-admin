import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';

import {
  LocalizedNameFieldsComponent,
  toLocalizedName,
} from '../../../../shared/components/localized-name-fields/localized-name-fields.component';
import { AppMenuItem, AppMenuRole, AppMenuService, AppMenuTargets, AppMenuUser, SaveAppMenuItem } from '../../services/app-menu.service';

export interface AppMenuFormData {
  item?: AppMenuItem;
  roles: AppMenuRole[];
  targets: AppMenuTargets;
  /** Seccion preseleccionada al crear. */
  section?: string;
  /** Orden sugerido al crear (al final). */
  nextOrder?: number;
}

@Component({
  selector: 'app-app-menu-form',
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
    MatAutocompleteModule,
    MatChipsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>{{ isEdit ? 'edit' : 'playlist_add' }}</mat-icon></div>
        <div class="header-text">
          <h2>{{ isEdit ? 'Editar opción del menú' : 'Nueva opción del menú' }}</h2>
          <p>{{ sectionHint() }} Los cambios se ven en la app sin publicar una versión nueva.</p>
        </div>
        <button mat-icon-button type="button" class="close" (click)="dialogRef.close(false)" [disabled]="saving()" aria-label="Cerrar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="body" id="appMenuForm">
        <!-- 1. Dónde y qué abre -->
        <section class="block">
          <div class="block-title"><span class="num">1</span> Ubicación y destino</div>
          <div class="grid">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Menú</mat-label>
              <mat-select formControlName="section">
                <mat-option value="SETTINGS">Mi cuenta</mat-option>
                <mat-option value="TABS">Barra inferior</mat-option>
                @if (customSection) {
                  <mat-option [value]="customSection">{{ customSection }}</mat-option>
                }
              </mat-select>
              @if (isEdit) {
                <mat-hint>No se cambia al editar.</mat-hint>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Código</mat-label>
              <input matInput formControlName="code" placeholder="METODO_PAGO" autocomplete="off" (input)="upper('code')" />
              <mat-hint>{{ isEdit ? 'No se cambia (identificador).' : 'MAYÚSCULAS y _ (ej. METODO_PAGO)' }}</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
              <mat-label>Ruta en la app</mat-label>
              <input matInput formControlName="link" [placeholder]="form.getRawValue().section === 'TABS' ? '/navigation/home' : '/navigation/settings/metodo-de-pago'" autocomplete="off" />
              @if (form.getRawValue().section === 'TABS') {
                <mat-hint>Barra inferior: una pantalla que ya exista en la app (/navigation/home, /navigation/quote...).</mat-hint>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Ícono (Ionicons)</mat-label>
              <input matInput formControlName="icon" placeholder="card-outline" autocomplete="off" />
              <mat-hint><a href="https://ionic.io/ionicons" target="_blank" rel="noopener">Ver íconos disponibles</a></mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Orden</mat-label>
              <input matInput type="number" formControlName="sortOrder" />
              <mat-hint>Menor = más arriba</mat-hint>
            </mat-form-field>
          </div>
        </section>

        <!-- 2. Nombre -->
        <section class="block">
          <div class="block-title"><span class="num">2</span> Nombre visible</div>
          <app-localized-name-fields [group]="labelGroup" [initial]="data.item?.label" title="Nombre en cada idioma" />
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
            <mat-label>Clave de traducción (opcional)</mat-label>
            <input matInput formControlName="labelKey" placeholder="SETTINGS.MENU.PAYMENT_METHOD" autocomplete="off" />
            <mat-hint>Solo si no escribe el nombre arriba: la app usa su propia traducción.</mat-hint>
          </mat-form-field>
        </section>

        <!-- 3. Quién la ve -->
        <section class="block">
          <div class="block-title"><span class="num">3</span> ¿Quién la ve? <small>Basta con cumplir una de estas opciones</small></div>
          <div class="grid">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
              <mat-label>Tipo de usuario</mat-label>
              <mat-select formControlName="roles" multiple>
                @for (r of data.roles; track r.code) {
                  <mat-option [value]="r.code">{{ r.label }}</mat-option>
                }
              </mat-select>
              <mat-hint>Respeta el "Modo trabajo" de la app.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Roles (Gestión de Roles)</mat-label>
              <mat-select formControlName="roleIds" multiple>
                @for (r of data.targets.roles; track r.id) {
                  <mat-option [value]="r.id">{{ r.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Roles de empleado</mat-label>
              <mat-select formControlName="employeeRoleTypeIds" multiple>
                @for (t of data.targets.employeeRoleTypes; track t.id) {
                  <mat-option [value]="t.id">{{ t.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
              <mat-label>Usuarios específicos</mat-label>
              <mat-chip-grid #userChips>
                @for (u of users(); track u.id) {
                  <mat-chip-row (removed)="removeUser(u)">
                    {{ u.name || u.email }}
                    <button matChipRemove type="button"><mat-icon>cancel</mat-icon></button>
                  </mat-chip-row>
                }
                <input placeholder="Buscar por nombre o email..." [formControl]="userSearch" [matAutocomplete]="userAuto" [matChipInputFor]="userChips" />
              </mat-chip-grid>
              <mat-autocomplete #userAuto="matAutocomplete" (optionSelected)="addUser($event.option.value)">
                @for (u of userOptions(); track u.id) {
                  <mat-option [value]="u">{{ u.name }} · {{ u.email }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>
          @if (noAudience()) {
            <p class="warn"><mat-icon>warning</mat-icon> Sin destinatarios nadie verá esta opción.</p>
          }
        </section>

        <mat-slide-toggle color="primary" formControlName="isActive">Activa (se muestra en la app)</mat-slide-toggle>
      </form>

      <div class="actions">
        <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="saving()">Cancelar</button>
        <button mat-flat-button color="primary" type="submit" form="appMenuForm" [disabled]="form.invalid || saving()">
          @if (saving()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          {{ isEdit ? 'Guardar cambios' : 'Crear opción' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog { max-width: 760px; }
      /* Titulo y botones fijos; el contenido hace scroll dentro de la ventana. */
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
      .block-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--fac-text);
        small { font-weight: 400; color: var(--fac-text-muted); font-size: 12px; } }
      .num { width: 22px; height: 22px; border-radius: 50%; background: var(--fac-gradient); color: #fff; font-size: 12px;
        display: inline-flex; align-items: center; justify-content: center; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; mat-form-field { width: 100%; } }
      .span-2 { grid-column: 1 / -1; }
      .full { width: 100%; }
      .warn { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; color: #b45309;
        mat-icon { font-size: 16px; width: 16px; height: 16px; } }
      a { color: var(--fac-primary-deep, #0078ff); }
      .actions { position: sticky; bottom: 0; z-index: 3; display: flex; justify-content: flex-end; gap: 12px;
        padding: 12px 20px; background: var(--fac-surface, #fff); border-top: 1px solid var(--fac-border);
        button { border-radius: 10px; height: 44px; padding: 0 22px; display: inline-flex; align-items: center; gap: 6px; } }
      @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } .body { padding: 12px; } }
    `,
  ],
})
export class AppMenuFormComponent {
  protected readonly data: AppMenuFormData = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<AppMenuFormComponent, boolean>);
  private readonly service = inject(AppMenuService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.item;
  protected readonly saving = signal(false);
  protected readonly labelGroup = new FormGroup({});
  protected readonly users = signal<AppMenuUser[]>([...(this.data.item?.users ?? [])]);
  protected readonly userOptions = signal<AppMenuUser[]>([]);
  protected readonly userSearch = new FormControl<string | AppMenuUser>('', { nonNullable: true });

  protected readonly form = this.fb.group({
    code: [this.data.item?.code ?? '', [Validators.required, Validators.pattern(/^[A-Z0-9_]{2,60}$/)]],
    section: [this.data.item?.section ?? this.data.section ?? 'SETTINGS', [Validators.required, Validators.pattern(/^[A-Z0-9_]{2,40}$/)]],
    link: [this.data.item?.link ?? '', [Validators.required, Validators.maxLength(255)]],
    icon: [this.data.item?.icon ?? '', [Validators.required, Validators.maxLength(60)]],
    sortOrder: [this.data.item?.sortOrder ?? this.data.nextOrder ?? 0],
    roles: [this.data.item?.roles ?? ['USER'] as string[]],
    roleIds: [this.data.item?.roleIds ?? [] as number[]],
    employeeRoleTypeIds: [this.data.item?.employeeRoleTypeIds ?? [] as number[]],
    labelKey: [this.data.item?.labelKey ?? '', [Validators.maxLength(120)]],
    isActive: [this.data.item?.isActive ?? true],
  });

  constructor() {
    // Codigo y seccion identifican la opcion en la app: no se cambian al editar.
    if (this.isEdit) {
      this.form.controls.code.disable();
      this.form.controls.section.disable();
    }
    this.userSearch.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((v) => {
          const term = typeof v === 'string' ? v.trim() : '';
          return term.length < 2 ? of([]) : this.service.searchUsers(term).pipe(catchError(() => of([])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => this.userOptions.set(list.filter((u) => !this.users().some((x) => x.id === u.id))));
  }

  protected addUser(u: AppMenuUser): void {
    if (!this.users().some((x) => x.id === u.id)) this.users.update((list) => [...list, u]);
    this.userSearch.setValue('');
    this.userOptions.set([]);
  }

  protected removeUser(u: AppMenuUser): void {
    this.users.update((list) => list.filter((x) => x.id !== u.id));
  }

  /** Seccion distinta de SETTINGS/TABS (creada a mano): se conserva en la lista. */
  protected readonly customSection = ['SETTINGS', 'TABS'].includes(this.data.item?.section ?? this.data.section ?? 'SETTINGS')
    ? null
    : (this.data.item?.section ?? this.data.section ?? null);

  protected sectionHint(): string {
    const section = this.form.getRawValue().section;
    return section === 'TABS' ? 'Barra inferior de la app.' : section === 'SETTINGS' ? 'Menú "Mi cuenta" de la app.' : `Menú ${section}.`;
  }

  protected noAudience(): boolean {
    const v = this.form.getRawValue();
    return !(v.roles?.length || v.roleIds?.length || v.employeeRoleTypeIds?.length || this.users().length);
  }

  protected upper(name: 'code' | 'section'): void {
    const c = this.form.controls[name];
    const v = (c.value ?? '').toUpperCase().replace(/\s+/g, '_');
    if (v !== c.value) c.setValue(v, { emitEvent: false });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const label = toLocalizedName(this.labelGroup.getRawValue());
    if (!label && !v.labelKey?.trim()) {
      this.snackBar.open('Escriba el nombre visible (al menos en español) o una clave de traducción.', 'Cerrar', { duration: 5000 });
      return;
    }
    const payload: SaveAppMenuItem = {
      link: v.link!.trim(),
      icon: v.icon!.trim(),
      roles: v.roles ?? [],
      roleIds: v.roleIds ?? [],
      employeeRoleTypeIds: v.employeeRoleTypeIds ?? [],
      userIds: this.users().map((u) => u.id),
      sortOrder: Number(v.sortOrder ?? 0),
      isActive: !!v.isActive,
      labelKey: v.labelKey?.trim() || null,
      label,
    };
    if (!this.isEdit) {
      payload.code = v.code!.trim();
      payload.section = v.section!.trim();
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
          this.snackBar.open(this.isEdit ? 'Opción actualizada' : 'Opción creada', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar', 'Cerrar', { duration: 5000 }),
      });
  }
}
