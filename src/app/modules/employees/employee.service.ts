import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Employee } from '../../core/models/employee.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class EmployeeService extends ApiBaseService {
  private readonly endpoint = 'admin/employees';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Employee>> {
    return this.getPaginated<Employee>(this.endpoint, query);
  }

  getById(id: number): Observable<ApiResponse<Employee>> {
    return this.getById<Employee>(this.endpoint, id);
  }

  create(data: Partial<Employee>): Observable<ApiResponse<Employee>> {
    return this.create<Employee>(this.endpoint, data);
  }

  update(id: number, data: Partial<Employee>): Observable<ApiResponse<Employee>> {
    return this.update<Employee>(this.endpoint, id, data);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.delete<void>(this.endpoint, id);
  }

  toggle(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/toggle`,
      {}
    );
  }

  assignRole(id: number, roleId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/assign-role`,
      { roleId }
    );
  }
}
