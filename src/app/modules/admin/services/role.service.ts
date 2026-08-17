import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Role } from '../../../core/models/role.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class RoleService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Role>> {
    return this._getPaginated<Role>('roles', query);
  }
  getById(id: number): Observable<ApiResponse<Role>> {
    return this._getById<Role>('roles', id);
  }
  create(data: Partial<Role>): Observable<ApiResponse<Role>> {
    return this._create<Role>('roles', data);
  }
  update(id: number, data: Partial<Role>): Observable<ApiResponse<Role>> {
    return this._update<Role>('roles', id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>('roles', id);
  }
  getPermissions(_roleId: number): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/roles`);
  }
  setPermissions(_roleId: number, _permissionIds: number[]): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/roles`, {});
  }
}
