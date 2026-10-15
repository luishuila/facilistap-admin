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

@Injectable({ providedIn: 'root' })
export class StoreAdminService extends ApiBaseService {
  // StoreAdminController (/api/admin/store), modulo store.
  private readonly endpoint = 'admin/store';

  payments(settled?: boolean | null): Observable<AppointmentPaymentItem[]> {
    const params = settled == null ? undefined : { settled: String(settled) };
    return this._getAll<AppointmentPaymentItem>(`${this.endpoint}/payments`, params).pipe(map((r) => r.data ?? []));
  }

  /** Marca como liquidados (ya se le pagó al proveedor). */
  settle(ids: number[], note?: string): Observable<{ settled: number; total: number }> {
    return this._create<{ settled: number; total: number }>(`${this.endpoint}/payments/settle`, { ids, note }).pipe(
      map((r) => r.data as { settled: number; total: number }),
    );
  }
}
