import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Permission } from '../../core/models/permission.interface';
import { ApiResponse, PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class PermissionService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Permission>> {
    return this._getPaginated<Permission>(`${this.endpoint}/privileges`, query);
  }
  getById(id: number): Observable<ApiResponse<Permission>> {
    return this._getById<Permission>(`${this.endpoint}/privileges`, id);
  }
  create(data: Partial<Permission>): Observable<ApiResponse<Permission>> {
    return this._create<Permission>(`${this.endpoint}/privileges`, data);
  }
  update(id: number, data: Partial<Permission>): Observable<ApiResponse<Permission>> {
    return this._update<Permission>(`${this.endpoint}/privileges`, id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(`${this.endpoint}/privileges`, id);
  }
  getModules(): Observable<ApiResponse<string[]>> {
    return of({ success: true, statusCode: 200, message: 'ok', data: [] });
  }
}
