import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { User } from '../../core/models/user.interface';
import { ApiResponse, PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class UserService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<User>> {
    return this._getPaginated<User>(`${this.endpoint}/users`, query);
  }
  getById(id: string): Observable<ApiResponse<User>> {
    return this._getById<User>(`${this.endpoint}/users`, id);
  }
  create(data: Partial<User>): Observable<ApiResponse<User>> {
    return this._create<User>(`${this.endpoint}/users`, data);
  }
  update(id: string, data: Partial<User>): Observable<ApiResponse<User>> {
    return this._update<User>(`${this.endpoint}/users`, id, data);
  }
  delete(id: string): Observable<ApiResponse<void>> {
    return this._delete<void>(`${this.endpoint}/users`, id);
  }
  activate(id: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/users/${id}`, { isActive: true });
  }
  block(id: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/users/${id}`, { isBlocked: true });
  }
  unblock(id: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/users/${id}`, { isBlocked: false });
  }
  changeRole(id: string, roleId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/users/${id}`, { roles: [{ idRol: roleId }] });
  }
  resetPassword(id: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/auth/password/reset`, { userId: id });
  }
}
