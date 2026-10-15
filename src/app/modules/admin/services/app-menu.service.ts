import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';

/** Opcion del menu de la app (tabla `menus`). */
export interface AppMenuItem {
  id: number;
  code: string;
  section: string;
  labelKey: string | null;
  label: Record<string, string> | null;
  link: string;
  icon: string;
  roles: string[];
  /** Ademas la ven: roles de la tabla roles, roles de empleado y usuarios concretos. */
  roleIds: number[];
  employeeRoleTypeIds: number[];
  userIds: string[];
  users?: AppMenuUser[];
  isActive: boolean;
  sortOrder: number;
}

export interface AppMenuUser {
  id: string;
  name: string;
  email: string;
}

export interface AppMenuTargets {
  roles: { id: number; name: string; role: string }[];
  employeeRoleTypes: { id: number; name: string; code: string; isSystem: boolean }[];
}

export interface AppMenuRole {
  code: string;
  label: string;
}

export interface SaveAppMenuItem {
  code?: string;
  section?: string;
  labelKey?: string | null;
  label?: Record<string, string> | null;
  link?: string;
  icon?: string;
  roles?: string[];
  roleIds?: number[];
  employeeRoleTypeIds?: number[];
  userIds?: string[];
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class AppMenuService extends ApiBaseService {
  // MenuAdminController (/api/admin/menu), modulo menu.
  private readonly endpoint = 'admin/menu';
  private roles$?: Observable<AppMenuRole[]>;

  list(): Observable<AppMenuItem[]> {
    return this._getAll<AppMenuItem>(this.endpoint).pipe(map((res) => res.data ?? []));
  }
  roles(): Observable<AppMenuRole[]> {
    this.roles$ ??= this._getAll<AppMenuRole>(`${this.endpoint}/roles`).pipe(
      map((res) => res.data ?? []),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.roles$;
  }
  targets(): Observable<AppMenuTargets> {
    return this.http
      .get<ApiResponse<AppMenuTargets>>(`${this.baseUrl}/${this.endpoint}/targets`)
      .pipe(map((res) => res.data ?? { roles: [], employeeRoleTypes: [] }));
  }
  searchUsers(search: string): Observable<AppMenuUser[]> {
    return this.http
      .get<ApiResponse<AppMenuUser[]>>(`${this.baseUrl}/${this.endpoint}/users`, { params: { search } })
      .pipe(map((res) => res.data ?? []));
  }
  create(data: SaveAppMenuItem): Observable<ApiResponse<AppMenuItem>> {
    return this._create<AppMenuItem>(this.endpoint, data);
  }
  update(id: number, data: SaveAppMenuItem): Observable<ApiResponse<AppMenuItem>> {
    return this._update<AppMenuItem>(this.endpoint, id, data);
  }
  remove(id: number): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(this.endpoint, id);
  }
}
