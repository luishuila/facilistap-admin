import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { PaginatedResponse } from '../../../core/models/api-response.interface';

/**
 * BUSINESS: saldo para citas de un negocio · WALLET: saldo de FacilisTap a la billetera ·
 * VERIFICATION: saldo de FacilisTap para pagar la verificación de cuenta ·
 * SUBSCRIPTION: un plan de suscripción regalado (se activa al canjearse).
 */
export type BonusKind = 'BUSINESS' | 'WALLET' | 'VERIFICATION' | 'SUBSCRIPTION';

export const BONUS_KIND_LABELS: Record<BonusKind, string> = {
  WALLET: 'Billetera',
  VERIFICATION: 'Verificación',
  SUBSCRIPTION: 'Suscripción',
  BUSINESS: 'Negocio',
};
export type BonusStatus = 'ACTIVE' | 'UNCLAIMED' | 'USED_UP' | 'EXPIRED' | 'PAUSED' | 'CREDITED';

export const BONUS_STATUS_LABELS: Record<BonusStatus, string> = {
  ACTIVE: 'Con saldo',
  UNCLAIMED: 'Sin canjear',
  USED_UP: 'Agotado',
  EXPIRED: 'Vencido',
  PAUSED: 'Pausado',
  CREDITED: 'Cargado a la billetera',
};

export interface AdminBonus {
  id: number;
  kind: BonusKind;
  subscriptionPlan: string | null;
  subscriptionPlanLabel: string | null;
  providerId: number | null;
  providerName: string | null;
  code: string;
  title: string;
  amount: number;
  used: number;
  balance: number;
  status: BonusStatus;
  expiresAt: string | null;
  isActive: boolean;
  claimedAt: string | null;
  createdAt: string;
  owner: { id: string; name: string; username: string | null; img: string | null } | null;
  forRecipient: boolean;
}

export interface AdminBonusInput {
  kind: BonusKind;
  /** Solo SUBSCRIPTION: MONTHLY | SEMESTER | YEARLY. */
  subscriptionPlan: string | null;
  providerId: number | null;
  title: string;
  amount: number;
  recipientUserId: string | null;
  expiresAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class BonusService extends ApiBaseService {
  // ProviderBonusAdminController (/api/admin/bonuses): SuperAdmin o módulo "promotions".
  private readonly endpoint = 'admin/bonuses';

  list(page: number, limit: number, search: string, kind: string): Observable<PaginatedResponse<AdminBonus>> {
    return this._getPaginated<AdminBonus>(this.endpoint, { page, limit, search, filters: { kind } });
  }

  create(body: AdminBonusInput): Observable<AdminBonus> {
    return this._create<AdminBonus>(this.endpoint, body).pipe(map((r) => r.data!));
  }

  update(id: number, body: { title?: string; expiresAt?: string | null; isActive?: boolean }): Observable<AdminBonus> {
    return this._update<AdminBonus>(this.endpoint, id, body).pipe(map((r) => r.data!));
  }

  remove(id: number): Observable<unknown> {
    return this._delete(this.endpoint, id);
  }
}
