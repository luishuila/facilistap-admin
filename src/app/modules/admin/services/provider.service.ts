import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Provider } from '../../../core/models/provider.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class ProviderService extends ApiBaseService {
  // ProviderAdminController (/api/admin/providers): todas las empresas, solo SuperAdmin.
  private readonly endpoint = 'admin/providers';

  // El backend devuelve un array (sin paginar); paginamos/buscamos en el cliente.
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Provider>> {
    return this._getAll<Provider>(this.endpoint).pipe(
      map((res) => {
        let items = res.data ?? [];
        const term = (query.search ?? '').trim().toLowerCase();
        if (term) {
          items = items.filter((p) =>
            [p.name, p.email, p.username, p.ownerName, p.ownerUsername].some((v) => (v ?? '').toString().toLowerCase().includes(term)),
          );
        }
        items = [...items].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        const total = items.length;
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        return {
          items: items.slice((page - 1) * limit, page * limit),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }),
    );
  }
  getById(id: number): Observable<ApiResponse<Provider>> {
    return this._getById<Provider>(this.endpoint, id);
  }
  create(data: Partial<Provider>): Observable<ApiResponse<Provider>> {
    return this._create<Provider>(this.endpoint, data);
  }
  update(id: number, data: Partial<Provider>): Observable<ApiResponse<Provider>> {
    return this._update<Provider>(this.endpoint, id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(this.endpoint, id);
  }
  /** Activa o desactiva (PATCH :id/status). */
  setActive(id: number, active: boolean): Observable<ApiResponse<{ id: number; isActive: boolean }>> {
    return this.http.patch<ApiResponse<{ id: number; isActive: boolean }>>(`${this.baseUrl}/${this.endpoint}/${id}/status`, { active });
  }
}
