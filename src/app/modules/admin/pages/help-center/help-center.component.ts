import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize, forkJoin } from 'rxjs';

import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import {
  HelpArticleListItem,
  HelpCategoryAdmin,
  HelpCenterAdminService,
  HelpFeedbackItem,
  HelpSearchMiss,
  HelpSummary,
} from '../../services/help-center.service';
import { HelpArticleFormComponent, HelpArticleFormData } from './help-article-form.component';
import { HelpCategoryFormComponent, HelpCategoryFormData } from './help-category-form.component';
import { helpfulPercent, localizedNameOf } from './help-center.helpers';

type StatusFilter = 'all' | 'active' | 'hidden' | 'featured';
type FeedbackFilter = 'all' | 'yes' | 'no';

interface ArticleGroup {
  category: HelpCategoryAdmin;
  articles: HelpArticleListItem[];
}

const normalize = (text: string): string =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Centro de ayuda de la app (como el de Facebook): temas, artículos por idioma, qué tan
 * útiles le resultan a la gente y lo que buscan sin encontrar. Todo se ve en la app
 * (/ayuda) sin publicar una versión nueva.
 */
@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-center.component.html',
  styleUrls: ['./help-center.component.scss'],
})
export class HelpCenterComponent implements OnInit {
  private readonly service = inject(HelpCenterAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly name = localizedNameOf;
  protected readonly percent = helpfulPercent;

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly summary = signal<HelpSummary | null>(null);
  protected readonly categories = signal<HelpCategoryAdmin[]>([]);
  protected readonly articles = signal<HelpArticleListItem[]>([]);

  protected readonly feedback = signal<HelpFeedbackItem[]>([]);
  protected readonly feedbackLoading = signal(false);
  protected readonly feedbackFilter = signal<FeedbackFilter>('no');
  protected readonly misses = signal<HelpSearchMiss[]>([]);
  protected readonly missesLoading = signal(false);
  private feedbackLoaded = false;
  private missesLoaded = false;

  // Filtros de la lista de artículos
  protected readonly search = signal('');
  protected readonly categoryFilter = signal<number | 'all'>('all');
  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly helpfulRate = computed(() => {
    const s = this.summary();
    return s ? helpfulPercent(s.helpful, s.notHelpful) : null;
  });

  protected readonly groups = computed<ArticleGroup[]>(() => {
    const term = normalize(this.search().trim());
    const category = this.categoryFilter();
    const status = this.statusFilter();
    const visible = this.articles().filter((a) => {
      if (category !== 'all' && a.categoryId !== category) return false;
      if (status === 'active' && !a.isActive) return false;
      if (status === 'hidden' && a.isActive) return false;
      if (status === 'featured' && !a.isFeatured) return false;
      if (!term) return true;
      return normalize(`${localizedNameOf(a.title)} ${a.slug} ${localizedNameOf(a.summary)}`).includes(term);
    });
    return this.categories()
      .map((c) => ({ category: c, articles: visible.filter((a) => a.categoryId === c.id) }))
      .filter((g) => g.articles.length || (!term && category === 'all' && status === 'all'));
  });

  protected readonly visibleCount = computed(() => this.groups().reduce((n, g) => n + g.articles.length, 0));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(!this.articles().length);
    forkJoin({
      summary: this.service.summary(),
      categories: this.service.categories(),
      articles: this.service.articles(),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ summary, categories, articles }) => {
          this.summary.set(summary);
          this.categories.set(categories);
          this.articles.set(articles);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo cargar el Centro de ayuda', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onTabChange(index: number): void {
    if (index === 2 && !this.feedbackLoaded) this.loadFeedback();
    if (index === 3 && !this.missesLoaded) this.loadMisses();
  }

  // ─── Artículos ───
  protected openArticle(article?: HelpArticleListItem, extra: { categoryId?: number; keywords?: string } = {}): void {
    if (!this.categories().length) {
      this.snackBar.open('Primero cree un tema para el artículo.', 'Cerrar', { duration: 4000 });
      return;
    }
    const category = this.categoryFilter();
    this.dialog
      .open<HelpArticleFormComponent, HelpArticleFormData, boolean>(HelpArticleFormComponent, {
        width: '1100px',
        maxWidth: '96vw',
        maxHeight: '94vh',
        autoFocus: false,
        disableClose: true,
        data: {
          articleId: article?.id,
          categories: this.categories(),
          categoryId: extra.categoryId ?? (category !== 'all' ? category : undefined),
          keywords: extra.keywords,
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.load());
  }

  protected toggleArticle(article: HelpArticleListItem, field: 'isActive' | 'isFeatured', value: boolean): void {
    this.busy.set(true);
    this.service
      .updateArticle(article.id, { [field]: value })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const title = localizedNameOf(article.title);
          const text =
            field === 'isActive'
              ? value ? `"${title}" publicado en la app` : `"${title}" oculto en la app`
              : value ? `"${title}" en Preguntas frecuentes` : `"${title}" fuera de Preguntas frecuentes`;
          this.snackBar.open(text, 'Cerrar', { duration: 3000 });
          this.load();
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo cambiar', 'Cerrar', { duration: 5000 });
          this.load();
        },
      });
  }

  protected removeArticle(article: HelpArticleListItem): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar artículo',
        message: `Se quitará "${localizedNameOf(article.title)}" del Centro de ayuda. Si solo quiere ocultarlo, desactive "Publicado".`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.service
          .removeArticle(article.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Artículo eliminado', 'Cerrar', { duration: 3000 });
              this.load();
            },
            error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo eliminar', 'Cerrar', { duration: 5000 }),
          });
      });
  }

  protected clearFilters(): void {
    this.search.set('');
    this.categoryFilter.set('all');
    this.statusFilter.set('all');
  }

  // ─── Temas ───
  protected openCategory(category?: HelpCategoryAdmin): void {
    const list = this.categories();
    this.dialog
      .open<HelpCategoryFormComponent, HelpCategoryFormData, boolean>(HelpCategoryFormComponent, {
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
        disableClose: true,
        data: { category, nextOrder: (Math.max(0, ...list.map((c) => c.sortOrder)) || 0) + 10 },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.load());
  }

  /** Sube/baja un tema y renumera (10, 20, 30...) para que el orden quede limpio. */
  protected moveCategory(index: number, delta: number): void {
    const list = [...this.categories()];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const changes = list.map((c, i) => ({ c, order: (i + 1) * 10 })).filter(({ c, order }) => c.sortOrder !== order);
    if (!changes.length) return;

    this.busy.set(true);
    forkJoin(changes.map(({ c, order }) => this.service.updateCategory(c.id, { sortOrder: order })))
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.load(),
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo cambiar el orden', 'Cerrar', { duration: 5000 });
          this.load();
        },
      });
  }

  protected toggleCategory(category: HelpCategoryAdmin, active: boolean): void {
    this.busy.set(true);
    this.service
      .updateCategory(category.id, { isActive: active })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(active ? `${localizedNameOf(category.name)} visible en la app` : `${localizedNameOf(category.name)} oculto en la app`, 'Cerrar', {
            duration: 3000,
          });
          this.load();
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo cambiar', 'Cerrar', { duration: 5000 });
          this.load();
        },
      });
  }

  protected removeCategory(category: HelpCategoryAdmin): void {
    if (category.articleCount) {
      this.snackBar.open('El tema tiene artículos: muévalos a otro tema o elimínelos primero. Para ocultarlo, desactívelo.', 'Cerrar', {
        duration: 6000,
      });
      return;
    }
    this.confirmDialog
      .confirm({
        title: 'Eliminar tema',
        message: `Se quitará el tema "${localizedNameOf(category.name)}" del Centro de ayuda.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.service
          .removeCategory(category.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Tema eliminado', 'Cerrar', { duration: 3000 });
              this.load();
            },
            error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo eliminar', 'Cerrar', { duration: 5000 }),
          });
      });
  }

  // ─── Opiniones ───
  protected setFeedbackFilter(filter: FeedbackFilter): void {
    this.feedbackFilter.set(filter);
    this.loadFeedback();
  }

  protected loadFeedback(): void {
    this.feedbackLoaded = true;
    this.feedbackLoading.set(true);
    const filter = this.feedbackFilter();
    this.service
      .feedback(filter === 'all' ? {} : { helpful: filter === 'yes' })
      .pipe(
        finalize(() => this.feedbackLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => this.feedback.set(list),
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudieron cargar las opiniones', 'Cerrar', { duration: 5000 }),
      });
  }

  protected openArticleById(id: number): void {
    const article = this.articles().find((a) => a.id === id);
    if (article) this.openArticle(article);
  }

  // ─── Búsquedas sin resultado ───
  protected loadMisses(): void {
    this.missesLoaded = true;
    this.missesLoading.set(true);
    this.service
      .searchMisses()
      .pipe(
        finalize(() => this.missesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => this.misses.set(list),
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudieron cargar las búsquedas', 'Cerrar', { duration: 5000 }),
      });
  }

  /** Escribe el artículo que faltaba: el término queda como palabra clave para que lo encuentren. */
  protected writeArticleFor(miss: HelpSearchMiss): void {
    this.openArticle(undefined, { keywords: miss.term });
  }

  protected dismissMiss(miss: HelpSearchMiss): void {
    this.service
      .removeSearchMiss(miss.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.misses.update((list) => list.filter((m) => m.id !== miss.id));
          this.summary.update((s) => (s ? { ...s, missTerms: Math.max(0, s.missTerms - 1), missSearches: Math.max(0, s.missSearches - miss.searchCount) } : s));
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo descartar', 'Cerrar', { duration: 5000 }),
      });
  }
}
