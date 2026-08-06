import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Audit } from '../../core/models/audit.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class AuditService extends ApiBaseService {
  private readonly endpoint = 'admin/audit';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Audit>> {
    return this._getPaginated<Audit>(this.endpoint, query);
  }

  getById(id: number): Observable<ApiResponse<Audit>> {
    return this._getById<Audit>(this.endpoint, id);
  }

  export(query: PaginatedQuery): Observable<Blob> {
    const params = this.buildHttpParams({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      search: query.search,
      ...(query.filters ?? {}),
    });
    return this.http.get(`${this.baseUrl}/${this.endpoint}/export`, {
      params,
      responseType: 'blob',
    });
  }
}
