import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';

export type VerificationStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface VerificationDocumentInfo {
  index: number;
  type: string;
  label: string;
  mimeType: string;
}

/** Solicitud de verificación (insignia) de una cuenta o un negocio. */
export interface VerificationItem {
  id: number;
  subjectType: 'ACCOUNT' | 'PROVIDER';
  status: VerificationStatus;
  userId: string | null;
  userName: string;
  username: string | null;
  userEmail: string | null;
  providerId: number | null;
  providerName: string | null;
  documents: VerificationDocumentInfo[];
  /** Pago por Wompi (precio de la tabla maestra VERIFICATION). */
  amount: number;
  currency: string;
  paidAt: string | null;
  /** Hasta cuándo vale la insignia. */
  expiresAt: string | null;
  termsAcceptedAt: string;
  rejectionReason: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class VerificationService extends ApiBaseService {
  // VerificationAdminController (/api/admin/verifications), modulo verifications.
  private readonly endpoint = 'admin/verifications';

  list(status?: VerificationStatus | null): Observable<VerificationItem[]> {
    return this._getAll<VerificationItem>(this.endpoint, status ? { status } : undefined).pipe(map((r) => r.data ?? []));
  }

  get(id: number): Observable<VerificationItem> {
    return this._getById<VerificationItem>(this.endpoint, id).pipe(map((r) => r.data as VerificationItem));
  }

  /** El archivo llega por el API con el token del panel (la carpeta es privada). */
  document(id: number, index: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${this.endpoint}/${id}/documents/${index}`, { responseType: 'blob' });
  }

  approve(id: number): Observable<VerificationItem> {
    return this._patch<VerificationItem>(this.endpoint, `${id}/approve`, {}).pipe(map((r) => r.data as VerificationItem));
  }

  reject(id: number, reason: string): Observable<VerificationItem> {
    return this._patch<VerificationItem>(this.endpoint, `${id}/reject`, { reason }).pipe(map((r) => r.data as VerificationItem));
  }

  revoke(id: number): Observable<unknown> {
    return this._patch<unknown>(this.endpoint, `${id}/revoke`, {});
  }
}
