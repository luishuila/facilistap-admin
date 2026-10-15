import { Injectable } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';

/** Cuenta del panel (tabla admin_users): NO es un usuario de la app. */
export interface StaffMember {
  id: string;
  name: string;
  lastname: string | null;
  email: string;
  phone: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Modulos permitidos (vacio en super admin: tiene todos). */
  modules: string[];
  /** Sesiones abiertas ahora mismo. */
  activeSessions: number;
}

export interface PanelModuleOption {
  code: string;
  label: string;
}

export interface SaveStaff {
  name?: string;
  lastname?: string | null;
  email?: string;
  phone?: string | null;
  password?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  modules?: string[];
}

@Injectable({ providedIn: 'root' })
export class StaffService extends ApiBaseService {
  // AdminUsersController (/api/admin/admin-users): SOLO super admin.
  private readonly endpoint = 'admin/admin-users';
  private modules$?: Observable<PanelModuleOption[]>;

  list(): Observable<StaffMember[]> {
    return this._getAll<StaffMember>(this.endpoint).pipe(map((res) => res.data ?? []));
  }
  create(data: SaveStaff): Observable<ApiResponse<StaffMember>> {
    return this._create<StaffMember>(this.endpoint, data);
  }
  update(id: string, data: SaveStaff): Observable<ApiResponse<StaffMember>> {
    return this._update<StaffMember>(this.endpoint, id, data);
  }
  /** Clave temporal: debe cambiarla al entrar; se cierran sus sesiones. */
  resetPassword(id: string, password: string): Observable<ApiResponse<unknown>> {
    return this._create<unknown>(`${this.endpoint}/${id}/password`, { password });
  }
  /** Saca al administrativo del panel: cierra todas sus sesiones. */
  closeSessions(id: string): Observable<ApiResponse<{ id: string; closed: number }>> {
    return this._create<{ id: string; closed: number }>(`${this.endpoint}/${id}/sessions/close`, {});
  }
  /** Saca del panel a todos los administrativos menos a usted. */
  closeAllSessions(): Observable<ApiResponse<{ closed: number }>> {
    return this._create<{ closed: number }>(`${this.endpoint}/sessions/close-all`, {});
  }
  remove(id: string): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(this.endpoint, id);
  }
  /** Catalogo de modulos del panel (codigo + nombre). */
  modules(): Observable<PanelModuleOption[]> {
    this.modules$ ??= this._getAll<PanelModuleOption>('admin/auth/modules').pipe(
      map((res) => res.data ?? []),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.modules$;
  }

  /** Clave temporal fuerte (10+ con mayuscula, minuscula y numero) para cuentas nuevas o restablecidas. */
  generatePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const all = upper + lower + digits;
    const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
    const chars = [pick(upper), pick(lower), pick(digits), ...Array.from({ length: 9 }, () => pick(all))];
    return chars.sort(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 - 0.5).join('');
  }
}
