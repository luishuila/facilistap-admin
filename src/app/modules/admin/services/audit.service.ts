import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Audit } from '../../../core/models/audit.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class AuditService extends ApiBaseService {
  // AuditController (/api/audit-logs). Filtros: module, action, user, startDate, endDate.
  private readonly endpoint = 'audit-logs';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Audit>> {
    return this._getPaginated<Audit>(this.endpoint, query);
  }
  getById(id: number): Observable<ApiResponse<Audit>> {
    return this._getById<Audit>(this.endpoint, id);
  }
  /** Descarga CSV (Excel lo abre directamente). */
  export(query: PaginatedQuery): Observable<Blob> {
    const params = this.buildHttpParams({
      sortBy: query.sortBy,
      sortOrder: query.sortOrder?.toUpperCase(),
      ...(query.filters ?? {}),
    });
    return this.http.get(`${this.baseUrl}/${this.endpoint}/export`, { params, responseType: 'blob' });
  }
}
