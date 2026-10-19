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

/** Configuración de la billetera (Tienda → Billetera de la app). */
export interface WalletConfig {
  currency: string;
  coinValue: number;
  /** Recarga libre ("Otro valor"). */
  topUp: { min: number; max: number };
  packages: WalletPackage[];
}

export type WithdrawalStatus = 'PENDING' | 'PAID' | 'REJECTED';

/** Retiro de la billetera de un negocio (lo que ganó con citas pagadas en la app). */
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

  // ─── Retiros de la billetera de los negocios ───

  withdrawals(status?: WithdrawalStatus | null): Observable<ProviderWithdrawalItem[]> {
    return this._getAll<ProviderWithdrawalItem>(`${this.endpoint}/withdrawals`, status ? { status } : undefined).pipe(map((r) => r.data ?? []));
  }

  markWithdrawalPaid(id: number, reference?: string): Observable<ProviderWithdrawalItem> {
    return this._create<ProviderWithdrawalItem>(`${this.endpoint}/withdrawals/${id}/paid`, { reference }).pipe(map((r) => r.data as ProviderWithdrawalItem));
  }

  rejectWithdrawal(id: number, note: string): Observable<ProviderWithdrawalItem> {
    return this._create<ProviderWithdrawalItem>(`${this.endpoint}/withdrawals/${id}/reject`, { note }).pipe(map((r) => r.data as ProviderWithdrawalItem));
  }

  /** Marca como liquidados (ya se le pagó al proveedor). */
  settle(ids: number[], note?: string): Observable<{ settled: number; total: number }> {
    return this._create<{ settled: number; total: number }>(`${this.endpoint}/payments/settle`, { ids, note }).pipe(
      map((r) => r.data as { settled: number; total: number }),
    );
  }
}
