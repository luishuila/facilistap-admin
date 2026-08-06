import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Role } from '../../core/models/role.interface';
import { ApiResponse, PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class RoleService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Role>> {
    return this._getPaginated<Role>(`${this.endpoint}/roles`, query);
  }
  getById(id: number): Observable<ApiResponse<Role>> {
    return this._getById<Role>(`${this.endpoint}/roles`, id);
  }
  create(data: Partial<Role>): Observable<ApiResponse<Role>> {
    return this._create<Role>(`${this.endpoint}/roles`, data);
  }
  update(id: number, data: Partial<Role>): Observable<ApiResponse<Role>> {
    return this._update<Role>(`${this.endpoint}/roles`, id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(`${this.endpoint}/roles`, id);
  }
  getPermissions(_roleId: number): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/${this.endpoint}/roles`);
  }
  setPermissions(_roleId: number, _permissionIds: number[]): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/roles`, {});
  }
}
