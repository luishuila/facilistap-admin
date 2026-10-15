import { Injectable } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';
import { Language, SaveLanguage } from '../../../core/models/language.interface';

@Injectable({ providedIn: 'root' })
export class LanguageService extends ApiBaseService {
  // LanguageController (/api/language): leer activos es publico; administrar exige SuperAdmin.
  private readonly endpoint = 'language';
  private active$?: Observable<Language[]>;

  /** Idiomas activos, ordenados; se cachea para los formularios de traduccion. */
  getActive(): Observable<Language[]> {
    this.active$ ??= this._getAll<Language>(this.endpoint).pipe(
      map((res) => [...(res.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.active$;
  }

  /** Todos (incluidos inactivos) para la pantalla de Idiomas. */
  getAll(): Observable<ApiResponse<Language[]>> {
    return this._getAll<Language>(`${this.endpoint}/all`);
  }
  create(data: SaveLanguage): Observable<ApiResponse<Language>> {
    return this._create<Language>(this.endpoint, data).pipe(tap(() => this.invalidate()));
  }
  update(id: number, data: SaveLanguage): Observable<ApiResponse<Language>> {
    return this._update<Language>(this.endpoint, id, data).pipe(tap(() => this.invalidate()));
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(this.endpoint, id).pipe(tap(() => this.invalidate()));
  }

  private invalidate(): void {
    this.active$ = undefined;
  }
}
