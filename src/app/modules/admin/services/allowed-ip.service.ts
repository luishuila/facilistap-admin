import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';

/** A quien aplica: un grupo o una persona (USER). */
export type AllowedIpScope = 'ALL' | 'SUPER_ADMINS' | 'STAFF' | 'USER';

export interface AllowedIp {
  id: number;
  scope: AllowedIpScope;
  scopeLabel: string;
  address: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  /** Administrativo al que aplica (null = todos). */
  adminUserId: string | null;
  adminUserName: string | null;
  adminUserEmail: string | null;
  /** La IP de quien esta mirando entra por esta regla. */
  matchesCurrent: boolean;
}

export interface AllowedIpOverview {
  /** IP publica con la que el backend ve esta sesion. */
  currentIp: string;
  /** Hay reglas activas: solo se entra desde esas IPs. */
  enabled: boolean;
  /** Apagada desde el servidor (ADMIN_IP_ALLOWLIST_DISABLED). */
  emergencyOff: boolean;
  currentAllowed: boolean;
  /** Con la proteccion activa, cuentas sin ninguna IP que les aplique: no pueden entrar. */
  withoutAccess: { id: string; name: string; email: string; isSuperAdmin: boolean }[];
  items: AllowedIp[];
}

export interface SaveAllowedIp {
  address?: string;
  label?: string;
  isActive?: boolean;
  scope?: AllowedIpScope;
  /** Solo con scope USER. */
  adminUserId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AllowedIpService extends ApiBaseService {
  // AdminAllowedIpsController (/api/admin/allowed-ips): SOLO super admin.
  private readonly endpoint = 'admin/allowed-ips';

  overview(): Observable<AllowedIpOverview> {
    return this.http
      .get<ApiResponse<AllowedIpOverview>>(`${this.baseUrl}/${this.endpoint}`)
      .pipe(map((res) => res.data as AllowedIpOverview));
  }
  create(data: SaveAllowedIp): Observable<ApiResponse<AllowedIp>> {
    return this._create<AllowedIp>(this.endpoint, data);
  }
  update(id: number, data: SaveAllowedIp): Observable<ApiResponse<AllowedIp>> {
    return this._update<AllowedIp>(this.endpoint, id, data);
  }
  remove(id: number): Observable<ApiResponse<unknown>> {
    return this._delete<unknown>(this.endpoint, id);
  }
}
