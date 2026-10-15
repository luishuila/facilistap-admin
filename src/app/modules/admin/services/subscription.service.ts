import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';
import {
  AdminSubscription,
  AdminTransaction,
  GrantSubscription,
  UserBilling,
} from '../../../core/models/subscription.interface';

@Injectable({ providedIn: 'root' })
export class SubscriptionService extends ApiBaseService {
  // BillingAdminController (/api/admin/subscriptions): solo SuperAdmin.
  private readonly endpoint = 'admin/subscriptions';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<AdminSubscription>> {
    return this._getPaginated<AdminSubscription>(this.endpoint, query);
  }
  getTransactions(query: PaginatedQuery): Observable<PaginatedResponse<AdminTransaction>> {
    return this._getPaginated<AdminTransaction>(`${this.endpoint}/transactions`, query);
  }
  getUserBilling(userId: string): Observable<ApiResponse<UserBilling>> {
    return this._getById<UserBilling>(`${this.endpoint}/user`, userId);
  }
  /** Activa o extiende: suma dias desde el fin vigente (o desde hoy si ya vencio). */
  activate(data: GrantSubscription): Observable<ApiResponse<unknown>> {
    return this._create<unknown>(`${this.endpoint}/activate`, data);
  }
  cancel(subscriptionId: number): Observable<ApiResponse<unknown>> {
    return this.http.patch<ApiResponse<unknown>>(`${this.baseUrl}/${this.endpoint}/${subscriptionId}/cancel`, {});
  }
}
