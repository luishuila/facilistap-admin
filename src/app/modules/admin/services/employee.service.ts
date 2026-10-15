import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Employee } from '../../../core/models/employee.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class EmployeeService extends ApiBaseService {
  // EmployeeAdminController (/api/admin/employees): todas las empresas, solo SuperAdmin.
  private readonly endpoint = 'admin/employees';

  // El backend devuelve un array (sin paginar); paginamos/buscamos en el cliente.
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Employee>> {
    return this._getAll<Employee>(this.endpoint).pipe(
      map((res) => {
        let items = res.data ?? [];
        const term = (query.search ?? '').trim().toLowerCase();
        if (term) {
          items = items.filter((e) =>
            [e.position, e.employeeCode, e.userFullName, e.email, e.providerName].some((v) =>
              (v ?? '').toString().toLowerCase().includes(term),
            ),
          );
        }
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
  getById(id: number): Observable<ApiResponse<Employee>> {
    return this._getById<Employee>(this.endpoint, id);
  }
  create(data: Partial<Employee>): Observable<ApiResponse<Employee>> {
    return this._create<Employee>(this.endpoint, data);
  }
  update(id: number, data: Partial<Employee>): Observable<ApiResponse<Employee>> {
    return this._update<Employee>(this.endpoint, id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(this.endpoint, id);
  }
  /** Activa o desactiva (PATCH :id/status). */
  setActive(id: number, active: boolean): Observable<ApiResponse<{ id: number; isActive: boolean }>> {
    return this.http.patch<ApiResponse<{ id: number; isActive: boolean }>>(`${this.baseUrl}/${this.endpoint}/${id}/status`, { active });
  }
  assignRole(id: number, roleId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/${id}`, { roleId });
  }
}
