import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Provider } from '../../core/models/provider.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class ProviderService extends ApiBaseService {
  private readonly endpoint = 'admin/providers';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Provider>> {
    return this._getPaginated<Provider>(this.endpoint, query);
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

  toggle(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/toggle`,
      {}
    );
  }
}
