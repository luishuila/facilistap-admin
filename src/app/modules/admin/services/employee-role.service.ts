import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';

export type EmployeeRoleCode = 'EMPLOYEE' | 'ASSISTANT';
export type AssistantPermissionKey = 'replyMessages' | 'editProfile' | 'publishPosts';
export type AssistantPermissions = Record<AssistantPermissionKey, boolean>;

/** Persona en una empresa con sus roles (employee_roles) y permisos de asistente. */
export interface EmployeeRoleRow {
  id: number;
  userFullName: string;
  email: string | null;
  providerId: number | null;
  providerName: string | null;
  independent: boolean;
  isActive: boolean;
  roles: EmployeeRoleCode[];
  /** Rol del catalogo asignado (null = Empleado/Asistente marcados a mano). */
  roleTypeId: number | null;
  roleTypeName: string | null;
  assistantPermissions: AssistantPermissions | null;
}

/** Rol de empleado creado en el panel (employee_role_types). */
export interface EmployeeRoleType {
  id: number;
  code: string;
  name: string;
  localizedName: Record<string, string>;
  description: string | null;
  attendsServices: boolean;
  managesAgenda: boolean;
  permissions: AssistantPermissions;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  employeesCount: number;
}

export interface SaveEmployeeRoleType {
  name?: string;
  localizedName?: Record<string, string> | null;
  description?: string;
  attendsServices?: boolean;
  managesAgenda?: boolean;
  permissions?: AssistantPermissions;
  isActive?: boolean;
  sortOrder?: number;
}

export interface EmployeeRoleCatalog {
  roles: { code: EmployeeRoleCode; label: string; description: string }[];
  permissions: { key: AssistantPermissionKey; label: string; description: string }[];
}

@Injectable({ providedIn: 'root' })
export class EmployeeRoleService extends ApiBaseService {
  // EmployeeRoleAdminController (/api/admin/employee-roles), modulo employee_roles.
  private readonly endpoint = 'admin/employee-roles';
  private catalog$?: Observable<EmployeeRoleCatalog>;

  list(): Observable<EmployeeRoleRow[]> {
    return this._getAll<EmployeeRoleRow>(this.endpoint).pipe(map((res) => res.data ?? []));
  }

  catalog(): Observable<EmployeeRoleCatalog> {
    this.catalog$ ??= this.http
      .get<ApiResponse<EmployeeRoleCatalog>>(`${this.baseUrl}/${this.endpoint}/catalog`)
      .pipe(
        map((res) => res.data ?? { roles: [], permissions: [] }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.catalog$;
  }

  setRoles(id: number, roles: EmployeeRoleCode[], assistantPermissions?: AssistantPermissions): Observable<ApiResponse<unknown>> {
    return this._update<unknown>(this.endpoint, id, { roles, assistantPermissions });
  }

  /** Asigna un rol del catalogo: el backend aplica sus funciones y permisos. */
  setRoleType(id: number, roleTypeId: number): Observable<ApiResponse<unknown>> {
    return this._update<unknown>(this.endpoint, id, { roleTypeId });
  }

  // --- Catalogo de roles (EmployeeRoleTypeAdminController) ---
  private readonly typesEndpoint = 'admin/employee-role-types';

  listTypes(): Observable<EmployeeRoleType[]> {
    return this._getAll<EmployeeRoleType>(this.typesEndpoint).pipe(map((res) => res.data ?? []));
  }
  createType(data: SaveEmployeeRoleType): Observable<ApiResponse<EmployeeRoleType>> {
    return this._create<EmployeeRoleType>(this.typesEndpoint, data);
  }
  updateType(id: number, data: SaveEmployeeRoleType): Observable<ApiResponse<EmployeeRoleType & { updatedEmployees: number }>> {
    return this._update<EmployeeRoleType & { updatedEmployees: number }>(this.typesEndpoint, id, data);
  }
  removeType(id: number): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(this.typesEndpoint, id);
  }
}
