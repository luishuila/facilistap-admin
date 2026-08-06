import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { User } from '../../core/models/user.interface';
import { Audit } from '../../core/models/audit.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class UserService extends ApiBaseService {
  private readonly endpoint = 'admin/users';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<User>> {
    return this._getPaginated<User>(this.endpoint, query);
  }

  getById(id: number): Observable<ApiResponse<User>> {
    return this._getById<User>(this.endpoint, id);
  }

  create(data: Partial<User>): Observable<ApiResponse<User>> {
    return this._create<User>(this.endpoint, data);
  }

  update(id: number, data: Partial<User>): Observable<ApiResponse<User>> {
    return this._update<User>(this.endpoint, id, data);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(this.endpoint, id);
  }

  activate(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/activate`,
      {}
    );
  }

  block(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/block`,
      {}
    );
  }

  unblock(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/unblock`,
      {}
    );
  }

  changeRole(id: number, roleId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/change-role`,
      { roleId }
    );
  }

  resetPassword(id: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/reset-password`,
      {}
    );
  }

  getHistory(id: number): Observable<ApiResponse<Audit[]>> {
    return this.http.get<ApiResponse<Audit[]>>(
      `${this.baseUrl}/${this.endpoint}/${id}/history`
    );
  }
}
