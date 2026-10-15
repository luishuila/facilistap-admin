import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { User } from '../../../core/models/user.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

/** Sesion abierta de un usuario en la app (un dispositivo). */
export interface AppUserSession {
  id: string;
  deviceInfo: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class UserService extends ApiBaseService {
  // Todo el CRUD de usuarios del panel va al AdminController (/api/users).
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<User>> {
    return this._getPaginated<User>('users', query).pipe(
      map((res) => ({ ...res, items: (res.items ?? []).map((u) => this.withDisplayFields(u)) })),
    );
  }
  getById(id: string): Observable<ApiResponse<User>> {
    return this._getById<User>('users', id);
  }
  create(data: unknown): Observable<ApiResponse<User>> {
    return this._create<User>('users', data);
  }
  update(id: string, data: unknown): Observable<ApiResponse<User>> {
    return this._update<User>('users', id, data);
  }
  /** Dispositivos con sesion abierta en la app. */
  sessions(id: string): Observable<AppUserSession[]> {
    return this.http
      .get<ApiResponse<AppUserSession[]>>(`${this.baseUrl}/users/${id}/sessions`)
      .pipe(map((res) => res.data ?? []));
  }
  /** Saca al usuario de la app en todos sus dispositivos. */
  closeAllSessions(id: string): Observable<ApiResponse<{ id: string; closed: number }>> {
    return this._create<{ id: string; closed: number }>(`users/${id}/sessions/close`, {});
  }
  /** Cierra la sesion de un dispositivo. */
  closeSession(id: string, sessionId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/users/${id}/sessions/${sessionId}`);
  }
  delete(id: string): Observable<ApiResponse<void>> {
    return this._delete<void>('users', id);
  }
  // El endpoint del backend devuelve `name`/`lastname` y `roles[]`; la tabla usa
  // `firstName`/`lastName`/`roleName`/`roleId`, así que los derivamos aquí.
  private withDisplayFields(user: User): User {
    const role = user.roles?.[0];
    return {
      ...user,
      firstName: user.firstName ?? user.name,
      lastName: user.lastName ?? user.lastname,
      roleName: user.roleName ?? role?.name ?? '',
      roleId: user.roleId ?? role?.id ?? role?.idRol,
    };
  }
  activate(id: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/users/${id}`, { isActive: true });
  }
  block(id: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/users/${id}`, { isBlocked: true });
  }
  unblock(id: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/users/${id}`, { isBlocked: false });
  }
  changeRole(id: string, roleId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/users/${id}`, { roles: [{ idRol: roleId }] });
  }
  resetPassword(id: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/auth/password/reset`, { userId: id });
  }
}
