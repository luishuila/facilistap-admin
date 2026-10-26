import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';

/** Pago de una cita hecho en la Tienda de la app (con Wompi o con monedas). */
export interface AppointmentPaymentItem {
  id: number;
  appointmentId: number;
  providerId: number | null;
  providerName: string;
  userName: string;
  method: 'WOMPI' | 'COINS';
  amount: number;
  currency: string;
  coins: number;
  commissionPercent: number;
  commissionAmount: number;
  /** Lo que se le debe pagar al proveedor. */
  providerAmount: number;
  paidAt: string;
  settledAt: string | null;
  settledByName: string | null;
  settlementNote: string | null;
}

/** Descuento de un paquete: % sobre lo que recibe o valor fijo. */
export type PackageDiscountType = 'PERCENT' | 'AMOUNT';

/** Paquete de recarga de la billetera: el usuario recibe `value` y paga `price` (= value - descuento). */
export interface WalletPackage {
  id: number;
  code: string;
  value: number;
  discountType: PackageDiscountType | null;
  discountValue: number;
  price: number;
  isActive: boolean;
}

/** Lo que se envía al crear o editar un paquete (el precio lo calcula el servidor). */
export interface WalletPackageInput {
  value?: number;
  discountType?: PackageDiscountType | null;
  discountValue?: number;
  isActive?: boolean;
}

/** Comisión de una pasarela: si se cobra y cuánto (%). */
export interface GatewayCommission {
  enabled: boolean;
  percent: number;
}

/** Configuración de la billetera (Tienda → Billetera de la app). */
export interface WalletConfig {
  currency: string;
  coinValue: number;
  /** Recarga libre ("Otro valor"). */
  topUp: { min: number; max: number };
  /** Mínimo (en dinero) para que un usuario pida el retiro de su billetera. */
  userWithdrawMin: number;
  /** Días después de la cita en que el negocio puede reembolsar una cita finalizada (0 = no se puede). */
  refundWindowDays: number;
  /** Horas que dura el enlace de pago para cualquiera. */
  paymentLinkHours: number;
  /** Horas que dura la solicitud de pago a un usuario de la app. */
  paymentRequestHours: number;
  /** Minutos desde que se finaliza la cita hasta que el negocio la puede retirar (0 = de una vez). */
  withdrawHoldMinutes: number;
  /** Comisión por pasarela de pago que se le suma al cliente (pagos con billetera o con Wompi). */
  commissions: { wallet: GatewayCommission; wompi: GatewayCommission };
  packages: WalletPackage[];
}

export type WithdrawalStatus = 'PENDING' | 'PAID' | 'REJECTED';
/** De quién es el retiro: un negocio (lo que ganó con citas) o un usuario (de su billetera). */
export type WithdrawalKind = 'provider' | 'user';

/**
 * Retiro de la billetera de un negocio (lo que ganó con citas pagadas en la app) o de un usuario
 * (el monto que eligió de su saldo). En los de usuario no hay negocio: providerId es null.
 */
export interface ProviderWithdrawalItem {
  id: number;
  createdAt: string;
  amount: number;
  currency: string;
  method: 'BANK_ACCOUNT' | 'NEQUI' | 'DAVIPLATA';
  account: {
    holderName: string; documentType?: string; documentTypeName?: string; documentNumber: string;
    bankCode?: string; bankName?: string; accountType?: string; accountTypeName?: string; accountNumber?: string; phone?: string;
  };
  status: WithdrawalStatus;
  adminNote: string | null;
  paymentReference: string | null;
  reviewedAt: string | null;
  providerId: number | null;
  providerName: string;
  requestedByName: string;
  requestedByEmail: string | null;
  reviewedByName: string | null;
}

@Injectable({ providedIn: 'root' })
export class StoreAdminService extends ApiBaseService {
  // StoreAdminController (/api/admin/store), modulo store.
  private readonly endpoint = 'admin/store';

  payments(settled?: boolean | null): Observable<AppointmentPaymentItem[]> {
    const params = settled == null ? undefined : { settled: String(settled) };
    return this._getAll<AppointmentPaymentItem>(`${this.endpoint}/payments`, params).pipe(map((r) => r.data ?? []));
  }

  // ─── Billetera ───

  walletConfig(): Observable<WalletConfig> {
    return this._getById<WalletConfig>(this.endpoint, 'wallet-config').pipe(map((r) => r.data as WalletConfig));
  }

  updateCommissions(body: Partial<Record<'wallet' | 'wompi', GatewayCommission>>): Observable<WalletConfig> {
    return this._update<WalletConfig>(`${this.endpoint}/wallet-config`, 'commissions', body).pipe(map((r) => r.data as WalletConfig));
  }

  updateUserWithdrawMin(min: number): Observable<WalletConfig> {
    return this._update<WalletConfig>(`${this.endpoint}/wallet-config`, 'user-withdraw-min', { min }).pipe(map((r) => r.data as WalletConfig));
  }

  updateRefundWindow(days: number): Observable<WalletConfig> {
    return this._update<WalletConfig>(`${this.endpoint}/wallet-config`, 'refund-window', { days }).pipe(map((r) => r.data as WalletConfig));
  }

  updatePaymentLinkHours(body: { link?: number; request?: number }): Observable<WalletConfig> {
    return this._update<WalletConfig>(`${this.endpoint}/wallet-config`, 'payment-link-hours', body).pipe(map((r) => r.data as WalletConfig));
  }

  updateWithdrawHold(minutes: number): Observable<WalletConfig> {
    return this._update<WalletConfig>(`${this.endpoint}/wallet-config`, 'withdraw-hold', { minutes }).pipe(map((r) => r.data as WalletConfig));
  }

  updateTopUp(min: number, max: number): Observable<WalletConfig> {
    return this._update<WalletConfig>(`${this.endpoint}/wallet-config`, 'top-up', { min, max }).pipe(map((r) => r.data as WalletConfig));
  }

  createPackage(body: WalletPackageInput): Observable<WalletConfig> {
    return this._create<WalletConfig>(`${this.endpoint}/wallet-config/packages`, body).pipe(map((r) => r.data as WalletConfig));
  }

  updatePackage(id: number, body: WalletPackageInput): Observable<WalletConfig> {
    return this._patch<WalletConfig>(`${this.endpoint}/wallet-config/packages`, id, body).pipe(map((r) => r.data as WalletConfig));
  }

  deletePackage(id: number): Observable<WalletConfig> {
    return this._delete<WalletConfig>(`${this.endpoint}/wallet-config/packages`, id).pipe(map((r) => r.data as WalletConfig));
  }

  // ─── Retiros de la billetera de los negocios y de los usuarios ───

  private withdrawalsPath(kind: WithdrawalKind): string {
    return `${this.endpoint}/${kind === 'user' ? 'user-withdrawals' : 'withdrawals'}`;
  }

  withdrawals(status?: WithdrawalStatus | null, kind: WithdrawalKind = 'provider'): Observable<ProviderWithdrawalItem[]> {
    return this._getAll<ProviderWithdrawalItem>(this.withdrawalsPath(kind), status ? { status } : undefined).pipe(
      map((r) => (r.data ?? []).map((w) => (kind === 'user' ? { ...w, providerId: null, providerName: 'Billetera personal' } : w))),
    );
  }

  markWithdrawalPaid(id: number, reference?: string, kind: WithdrawalKind = 'provider'): Observable<ProviderWithdrawalItem> {
    return this._create<ProviderWithdrawalItem>(`${this.withdrawalsPath(kind)}/${id}/paid`, { reference }).pipe(map((r) => r.data as ProviderWithdrawalItem));
  }

  rejectWithdrawal(id: number, note: string, kind: WithdrawalKind = 'provider'): Observable<ProviderWithdrawalItem> {
    return this._create<ProviderWithdrawalItem>(`${this.withdrawalsPath(kind)}/${id}/reject`, { note }).pipe(map((r) => r.data as ProviderWithdrawalItem));
  }

  /** Marca como liquidados (ya se le pagó al proveedor). */
  settle(ids: number[], note?: string): Observable<{ settled: number; total: number }> {
    return this._create<{ settled: number; total: number }>(`${this.endpoint}/payments/settle`, { ids, note }).pipe(
      map((r) => r.data as { settled: number; total: number }),
    );
  }
}
