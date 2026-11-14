import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';
import { LocalizedName } from '../../../core/models/language.interface';

/** Tema del Centro de ayuda (tabla help_categories). */
export interface HelpCategoryAdmin {
  id: number;
  code: string;
  name: LocalizedName;
  description: LocalizedName | null;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  articleCount: number;
  activeArticleCount: number;
}

/** Fila de la lista de artículos (sin el cuerpo). */
export interface HelpArticleListItem {
  id: number;
  slug: string;
  title: LocalizedName;
  summary: LocalizedName | null;
  categoryId: number;
  categoryName: LocalizedName;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  viewCount: number;
  actionLink: string | null;
  updatedAt: string;
  /** Idiomas con título y contenido. */
  langs: string[];
  helpful: number;
  notHelpful: number;
}

/** Artículo completo para editarlo. */
export interface HelpArticleDetail {
  id: number;
  categoryId: number;
  slug: string;
  title: LocalizedName;
  summary: LocalizedName | null;
  body: LocalizedName;
  keywords: string | null;
  actionLabel: LocalizedName | null;
  actionLink: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  viewCount: number;
  updatedAt: string;
}

export interface SaveHelpCategory {
  code?: string;
  name?: LocalizedName;
  description?: LocalizedName | null;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface SaveHelpArticle {
  categoryId?: number;
  slug?: string;
  title?: LocalizedName;
  summary?: LocalizedName | null;
  body?: LocalizedName;
  keywords?: string | null;
  actionLabel?: LocalizedName | null;
  actionLink?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface HelpSummary {
  categories: number;
  articles: number;
  activeArticles: number;
  featuredArticles: number;
  views: number;
  helpful: number;
  notHelpful: number;
  missTerms: number;
  missSearches: number;
}

export interface HelpFeedbackItem {
  id: number;
  helpful: boolean;
  reason: string | null;
  reasonLabel: string | null;
  comment: string | null;
  lang: string | null;
  createdAt: string;
  articleId: number;
  articleSlug: string;
  articleTitle: LocalizedName;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

export interface HelpSearchMiss {
  id: number;
  term: string;
  lang: string;
  searchCount: number;
  lastSearchedAt: string;
  createdAt: string;
}

/** HelpCenterAdminController (/api/admin/help-center), módulo help_center del panel. */
@Injectable({ providedIn: 'root' })
export class HelpCenterAdminService extends ApiBaseService {
  private readonly endpoint = 'admin/help-center';

  summary(): Observable<HelpSummary> {
    return this.http
      .get<ApiResponse<HelpSummary>>(`${this.baseUrl}/${this.endpoint}/summary`)
      .pipe(map((res) => res.data as HelpSummary));
  }

  // ─── Temas ───
  categories(): Observable<HelpCategoryAdmin[]> {
    return this._getAll<HelpCategoryAdmin>(`${this.endpoint}/categories`).pipe(map((res) => res.data ?? []));
  }
  createCategory(data: SaveHelpCategory): Observable<ApiResponse<HelpCategoryAdmin>> {
    return this._create<HelpCategoryAdmin>(`${this.endpoint}/categories`, data);
  }
  updateCategory(id: number, data: SaveHelpCategory): Observable<ApiResponse<HelpCategoryAdmin>> {
    return this._update<HelpCategoryAdmin>(`${this.endpoint}/categories`, id, data);
  }
  removeCategory(id: number): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(`${this.endpoint}/categories`, id);
  }

  // ─── Artículos ───
  articles(): Observable<HelpArticleListItem[]> {
    return this._getAll<HelpArticleListItem>(`${this.endpoint}/articles`).pipe(map((res) => res.data ?? []));
  }
  article(id: number): Observable<HelpArticleDetail> {
    return this._getById<HelpArticleDetail>(`${this.endpoint}/articles`, id).pipe(map((res) => res.data as HelpArticleDetail));
  }
  createArticle(data: SaveHelpArticle): Observable<ApiResponse<HelpArticleDetail>> {
    return this._create<HelpArticleDetail>(`${this.endpoint}/articles`, data);
  }
  updateArticle(id: number, data: SaveHelpArticle): Observable<ApiResponse<HelpArticleDetail>> {
    return this._update<HelpArticleDetail>(`${this.endpoint}/articles`, id, data);
  }
  removeArticle(id: number): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(`${this.endpoint}/articles`, id);
  }

  // ─── Opiniones y búsquedas sin resultado ───
  feedback(filters: { articleId?: number; helpful?: boolean } = {}): Observable<HelpFeedbackItem[]> {
    const params: Record<string, unknown> = {};
    if (filters.articleId) params['articleId'] = filters.articleId;
    if (filters.helpful !== undefined) params['helpful'] = String(filters.helpful);
    return this._getAll<HelpFeedbackItem>(`${this.endpoint}/feedback`, params).pipe(map((res) => res.data ?? []));
  }
  searchMisses(): Observable<HelpSearchMiss[]> {
    return this._getAll<HelpSearchMiss>(`${this.endpoint}/search-misses`).pipe(map((res) => res.data ?? []));
  }
  removeSearchMiss(id: number): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(`${this.endpoint}/search-misses`, id);
  }
}
