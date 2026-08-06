import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Role } from '../../core/models/role.interface';
import { Permission } from '../../core/models/permission.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class RoleService extends ApiBaseService {
  private readonly endpoint = 'admin/roles';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Role>> {
    return this.getPaginated<Role>(this.endpoint, query);
  }

  getById(id: number): Observable<ApiResponse<Role>> {
    return this.getById<Role>(this.endpoint, id);
  }

  create(data: Partial<Role>): Observable<ApiResponse<Role>> {
    return this.create<Role>(this.endpoint, data);
  }

  update(id: number, data: Partial<Role>): Observable<ApiResponse<Role>> {
    return this.update<Role>(this.endpoint, id, data);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.delete<void>(this.endpoint, id);
  }

  getPermissions(roleId: number): Observable<ApiResponse<Permission[]>> {
    return this.http.get<ApiResponse<Permission[]>>(
      `${this.baseUrl}/${this.endpoint}/${roleId}/permissions`
    );
  }

  setPermissions(roleId: number, permissionIds: number[]): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${roleId}/permissions`,
      { permissionIds }
    );
  }

  removePermission(roleId: number, permissionId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${roleId}/permissions/${permissionId}`
    );
  }
}
