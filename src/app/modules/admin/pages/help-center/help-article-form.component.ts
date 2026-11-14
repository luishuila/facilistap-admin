import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { LanguageService } from '../../services/language.service';
import { toLocalizedName } from '../../../../core/utils/localized-name.util';
import { renderHelpMarkdown, slugify } from '../../../../core/utils/help-markdown.util';
import { localizedNameOf } from './help-center.helpers';
import {
  HelpArticleDetail,
  HelpCategoryAdmin,
  HelpCenterAdminService,
  SaveHelpArticle,
} from '../../services/help-center.service';

export interface HelpArticleFormData {
  /** Id del artículo a editar (se carga completo con el cuerpo). */
  articleId?: number;
  categories: HelpCategoryAdmin[];
  /** Tema elegido al crear. */
  categoryId?: number;
  /** Palabras clave sugeridas (p. ej. desde "Búsquedas sin resultado"). */
  keywords?: string;
}

interface LangOption {
  code: string;
  label: string;
  flag: string | null;
}

/** Textos de un artículo en un idioma. */
interface LangTexts {
  title: string;
  summary: string;
  body: string;
  actionLabel: string;
}

const EMPTY_TEXTS: LangTexts = { title: '', summary: '', body: '', actionLabel: '' };

/** Pantallas de la app a las que puede llevar el botón del final del artículo. */
const APP_ROUTES: { link: string; label: string }[] = [
  { link: '/navigation/home', label: 'Inicio' },
  { link: '/navigation/quote', label: 'Mi agenda (pestaña Agenda)' },
  { link: '/navigation/micho', label: 'Micho (búsqueda por voz)' },
  { link: '/navigation/settings', label: 'Configuración (Mi cuenta)' },
  { link: '/navigation/settings/mi-perfil', label: 'Mi perfil' },
  { link: '/navigation/personalinformation', label: 'Editar perfil y Preferencias' },
  { link: '/navigation/sessions', label: 'Dispositivos y sesiones' },
  { link: '/navigation/settings/billetera', label: 'Mi billetera' },
  { link: '/navigation/settings/billetera-negocio', label: 'Billetera de tus negocios' },
  { link: '/navigation/settings/metodo-de-pago', label: 'Tienda' },
  { link: '/navigation/settings/reclamos', label: 'Mis solicitudes (PQRS)' },
  { link: '/navigation/settings/reclamos/crear', label: 'Nueva solicitud (PQRS)' },
  { link: '/navigation/settings/empleado-vinculado', label: 'Mis lugares de trabajo' },
  { link: '/navigation/provider', label: 'Mis negocios' },
  { link: '/navigation/provider-admin', label: 'Crear mi negocio' },
  { link: '/navigation/notificaciones', label: 'Notificaciones' },
  { link: '/navigation/mensajes', label: 'Mensajes' },
  { link: '/ayuda', label: 'Centro de ayuda' },
];

@Component({
  selector: 'app-help-article-form',
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
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-article-form.component.html',
  styleUrls: ['./help-article-form.component.scss'],
})
export class HelpArticleFormComponent implements OnInit {
  @ViewChild('bodyInput') private bodyInput?: ElementRef<HTMLTextAreaElement>;

  protected readonly data: HelpArticleFormData = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<HelpArticleFormComponent, boolean>);
  private readonly service = inject(HelpCenterAdminService);
  private readonly languageService = inject(LanguageService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isEdit = !!this.data.articleId;
  protected readonly loading = signal(this.isEdit);
  protected readonly saving = signal(false);
  protected readonly showPreview = signal(true);
  protected readonly appRoutes = APP_ROUTES;
  protected readonly categoryName = localizedNameOf;

  protected readonly languages = signal<LangOption[]>([{ code: 'es', label: 'Español', flag: null }]);
  protected readonly lang = signal('es');
  /** Textos por idioma; el editor muestra los del idioma elegido. */
  private readonly texts = signal<Record<string, LangTexts>>({ es: { ...EMPTY_TEXTS } });
  protected readonly article = signal<HelpArticleDetail | null>(null);

  /** Campos del idioma elegido (se guardan en `texts` al cambiar de idioma o al guardar). */
  protected readonly langForm = this.fb.nonNullable.group({
    title: ['', [Validators.maxLength(160)]],
    summary: ['', [Validators.maxLength(300)]],
    body: ['', [Validators.maxLength(20000)]],
    actionLabel: ['', [Validators.maxLength(60)]],
  });

  protected readonly form = this.fb.nonNullable.group({
    categoryId: [this.data.categoryId ?? this.data.categories[0]?.id ?? 0, [Validators.required, Validators.min(1)]],
    slug: ['', [Validators.maxLength(120), Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    keywords: [this.data.keywords ?? '', [Validators.maxLength(1000)]],
    actionLink: ['', [Validators.maxLength(200), Validators.pattern(/^(\/[A-Za-z0-9\-._~/?=&%]*|https:\/\/\S+)$/)]],
    sortOrder: [0],
    isFeatured: [false],
    isActive: [true],
  });

  /** Al crear, la dirección sigue al título en español hasta que se edite a mano. */
  private slugTouched = this.isEdit;
  protected readonly previewHtml = signal('');
  protected readonly filledLangs = computed(() => {
    const all = this.texts();
    return new Set(Object.keys(all).filter((code) => !!all[code]?.title.trim() && !!all[code]?.body.trim()));
  });

  ngOnInit(): void {
    this.languageService
      .getActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (langs) => {
          const list = langs.map((l) => ({ code: l.code, label: l.label || l.name, flag: l.flag }));
          if (!list.some((l) => l.code === 'es')) list.unshift({ code: 'es', label: 'Español', flag: null });
          // El español va primero: es el obligatorio y el que se usa si falta una traducción.
          list.sort((a, b) => (a.code === 'es' ? -1 : b.code === 'es' ? 1 : 0));
          this.languages.set(list);
        },
      });

    this.langForm.controls.body.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((body) => {
      this.previewHtml.set(renderHelpMarkdown(body));
      this.storeCurrent();
    });
    this.langForm.controls.title.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((title) => {
      if (!this.slugTouched && this.lang() === 'es') this.form.controls.slug.setValue(slugify(title), { emitEvent: false });
      this.storeCurrent();
    });
    this.langForm.controls.summary.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.storeCurrent());
    this.langForm.controls.actionLabel.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.storeCurrent());

    if (this.isEdit) this.loadArticle();
  }

  private loadArticle(): void {
    this.service
      .article(this.data.articleId!)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (article) => {
          this.article.set(article);
          const codes = new Set([
            ...Object.keys(article.title ?? {}),
            ...Object.keys(article.body ?? {}),
            ...Object.keys(article.summary ?? {}),
            ...Object.keys(article.actionLabel ?? {}),
          ]);
          const texts: Record<string, LangTexts> = {};
          for (const code of codes) {
            texts[code] = {
              title: article.title?.[code] ?? '',
              summary: article.summary?.[code] ?? '',
              body: article.body?.[code] ?? '',
              actionLabel: article.actionLabel?.[code] ?? '',
            };
          }
          this.texts.set(texts);
          this.form.patchValue({
            categoryId: article.categoryId,
            slug: article.slug,
            keywords: article.keywords ?? '',
            actionLink: article.actionLink ?? '',
            sortOrder: article.sortOrder,
            isFeatured: article.isFeatured,
            isActive: article.isActive,
          });
          this.loadLang('es');
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo cargar el artículo', 'Cerrar', { duration: 5000 });
          this.dialogRef.close(false);
        },
      });
  }

  /** Cambia el idioma que se está editando (lo escrito queda guardado en memoria). */
  protected selectLang(code: string): void {
    if (!code || code === this.lang()) return;
    this.storeCurrent();
    this.loadLang(code);
  }

  private loadLang(code: string): void {
    this.lang.set(code);
    const current = this.texts()[code] ?? EMPTY_TEXTS;
    this.langForm.setValue({ ...current }, { emitEvent: false });
    this.previewHtml.set(renderHelpMarkdown(current.body));
  }

  private storeCurrent(): void {
    const code = this.lang();
    const value = this.langForm.getRawValue();
    this.texts.update((all) => ({ ...all, [code]: { ...value } }));
  }

  /** Copia el texto en español como punto de partida para traducir. */
  protected copyFromSpanish(): void {
    const es = this.texts()['es'];
    if (!es) return;
    this.langForm.setValue({ ...es });
    this.storeCurrent();
  }

  protected onSlugInput(): void {
    this.slugTouched = true;
    const control = this.form.controls.slug;
    const clean = control.value.toLowerCase().replace(/\s+/g, '-');
    if (clean !== control.value) control.setValue(clean, { emitEvent: false });
  }

  // ─── Barra de formato del contenido ───
  protected wrap(prefix: string, suffix: string, placeholder: string): void {
    const el = this.bodyInput?.nativeElement;
    const control = this.langForm.controls.body;
    const value = control.value;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
    control.setValue(next);
    this.focusBody(start + prefix.length, start + prefix.length + selected.length);
  }

  /** Antepone algo al comienzo de cada línea elegida (título, punto, paso, nota). */
  protected linePrefix(kind: 'h' | 'ul' | 'ol' | 'tip'): void {
    const el = this.bodyInput?.nativeElement;
    const control = this.langForm.controls.body;
    const value = control.value;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd) || 'Texto';
    const lines = block.split('\n').map((line, i) => {
      const clean = line.replace(/^(#{1,4}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/, '');
      if (kind === 'h') return `## ${clean}`;
      if (kind === 'ul') return `- ${clean}`;
      if (kind === 'ol') return `${i + 1}. ${clean}`;
      return `> ${clean}`;
    });
    const replaced = lines.join('\n');
    control.setValue(`${value.slice(0, lineStart)}${replaced}${value.slice(lineEnd)}`);
    this.focusBody(lineStart, lineStart + replaced.length);
  }

  protected insertLink(): void {
    const link = this.form.controls.actionLink.value?.trim() || '/navigation/home';
    this.wrap('[', `](${link})`, 'texto del enlace');
  }

  protected insertImage(): void {
    this.wrap('![', '](https://)', 'descripción de la imagen');
  }

  private focusBody(selStart: number, selEnd: number): void {
    setTimeout(() => {
      const el = this.bodyInput?.nativeElement;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  protected routeLabel(link: string | null | undefined): string {
    return APP_ROUTES.find((r) => r.link === link)?.label ?? '';
  }

  protected save(): void {
    this.storeCurrent();
    if (this.form.invalid || this.langForm.invalid) {
      this.form.markAllAsTouched();
      this.langForm.markAllAsTouched();
      this.snackBar.open('Revise los campos en rojo.', 'Cerrar', { duration: 4000 });
      return;
    }

    const all = this.texts();
    const pick = (field: keyof LangTexts) =>
      toLocalizedName(Object.fromEntries(Object.entries(all).map(([code, t]) => [code, t[field]])));
    const title = pick('title');
    const body = pick('body');
    if (!title?.['es'] || !body?.['es']) {
      this.snackBar.open('Escriba el título y el contenido al menos en español.', 'Cerrar', { duration: 5000 });
      if (this.lang() !== 'es') this.selectLang('es');
      return;
    }
    // Un idioma con título sin contenido (o al revés) saldría a medias en la app.
    const partial = Object.entries(all).find(([, t]) => !!t.title.trim() !== !!t.body.trim());
    if (partial) {
      this.snackBar.open(`En ${partial[0].toUpperCase()} falta el título o el contenido.`, 'Cerrar', { duration: 5000 });
      this.selectLang(partial[0]);
      return;
    }

    const value = this.form.getRawValue();
    const actionLink = value.actionLink.trim() || null;
    const payload: SaveHelpArticle = {
      categoryId: Number(value.categoryId),
      title,
      body,
      summary: pick('summary'),
      keywords: value.keywords.trim() || null,
      actionLink,
      actionLabel: actionLink ? pick('actionLabel') : null,
      isFeatured: value.isFeatured,
      isActive: value.isActive,
      sortOrder: Number(value.sortOrder) || 0,
    };
    const slug = value.slug.trim();
    if (slug) payload.slug = slug;
    if (!this.isEdit && !value.sortOrder) delete payload.sortOrder; // el backend lo pone al final del tema

    this.saving.set(true);
    const request$ = this.isEdit ? this.service.updateArticle(this.data.articleId!, payload) : this.service.createArticle(payload);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(this.isEdit ? 'Artículo actualizado' : 'Artículo creado', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar el artículo', 'Cerrar', { duration: 6000 }),
      });
  }
}
