import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';

/** Fila de la tabla `maestra` (catalogos de la app agrupados por `groupName`). */
export interface MaestraItem {
  id: number;
  groupName: string;
  groupLabel: string;
  code: string;
  name: string;
  localizedName: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
  metadata: string | null;
}

/**
 * `metadata` con la forma `{ "value": ... }` (p. ej. grupo SUBSCRIPTION): devuelve el valor como texto.
 * `undefined` si no hay metadata o tiene otra forma (otros campos, JSON inválido).
 */
export function metadataValue(metadata: string | null | undefined): string | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata);
    const keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : [];
    return keys.length === 1 && keys[0] === 'value' && parsed.value !== null ? String(parsed.value) : undefined;
  } catch {
    return undefined;
  }
}

/** Valor -> metadata `{ "value": ... }`; los números se guardan como número. */
export function toValueMetadata(value: string): string {
  const v = value.trim();
  return JSON.stringify({ value: /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v });
}

export interface MaestraGroup {
  code: string;
  label: string;
}

export interface SaveMaestra {
  groupName?: string;
  code?: string;
  name?: string;
  localizedName?: Record<string, string> | null;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: string;
}

@Injectable({ providedIn: 'root' })
export class MaestraService extends ApiBaseService {
  // MaestraAdminController (/api/admin/maestra), modulo maestra.
  private readonly endpoint = 'admin/maestra';
  private groups$?: Observable<MaestraGroup[]>;

  list(): Observable<MaestraItem[]> {
    return this._getAll<MaestraItem>(this.endpoint).pipe(map((res) => res.data ?? []));
  }

  groups(): Observable<MaestraGroup[]> {
    this.groups$ ??= this._getAll<MaestraGroup>(`${this.endpoint}/groups`).pipe(
      map((res) => res.data ?? []),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.groups$;
  }

  create(data: SaveMaestra): Observable<ApiResponse<MaestraItem>> {
    return this._create<MaestraItem>(this.endpoint, data);
  }

  update(id: number, data: SaveMaestra): Observable<ApiResponse<MaestraItem>> {
    return this.http.patch<ApiResponse<MaestraItem>>(`${this.baseUrl}/${this.endpoint}/${id}`, data);
  }

  remove(id: number): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(this.endpoint, id);
  }
}
