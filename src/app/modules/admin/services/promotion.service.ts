import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { PaginatedResponse } from '../../../core/models/api-response.interface';
import {
  BusinessPromotion,
  BusinessPromotionInput,
  PromotionCatalogItem,
  SubscriptionPlanOption,
  SubscriptionPromotion,
  SubscriptionPromotionInput,
} from '../../../core/models/promotion.interface';

@Injectable({ providedIn: 'root' })
export class PromotionService extends ApiBaseService {
  // PromotionAdminController (/api/admin/promotions): SuperAdmin o módulo "promotions".
  private readonly endpoint = 'admin/promotions';

  // ─── Suscripción ───
  subscriptionPlans(): Observable<SubscriptionPlanOption[]> {
    return this._getAll<SubscriptionPlanOption>(`${this.endpoint}/subscription/plans`).pipe(map((r) => r.data ?? []));
  }

  listSubscription(): Observable<SubscriptionPromotion[]> {
    return this._getAll<SubscriptionPromotion>(`${this.endpoint}/subscription`).pipe(map((r) => r.data ?? []));
  }

  createSubscription(body: SubscriptionPromotionInput): Observable<SubscriptionPromotion> {
    return this._create<SubscriptionPromotion>(`${this.endpoint}/subscription`, body).pipe(map((r) => r.data!));
  }

  updateSubscription(id: number, body: Partial<SubscriptionPromotionInput> & { isActive?: boolean }): Observable<SubscriptionPromotion> {
    return this._update<SubscriptionPromotion>(`${this.endpoint}/subscription`, id, body).pipe(map((r) => r.data!));
  }

  removeSubscription(id: number): Observable<unknown> {
    return this._delete(`${this.endpoint}/subscription`, id);
  }

  // ─── Citas de los negocios ───
  listBusiness(page: number, limit: number, search: string): Observable<PaginatedResponse<BusinessPromotion>> {
    return this._getPaginated<BusinessPromotion>(`${this.endpoint}/business`, { page, limit, search });
  }

  catalog(providerId: number): Observable<PromotionCatalogItem[]> {
    return this._getAll<PromotionCatalogItem>(`${this.endpoint}/business/${providerId}/catalog`).pipe(map((r) => r.data ?? []));
  }

  createBusiness(providerId: number, body: BusinessPromotionInput): Observable<BusinessPromotion> {
    return this._create<BusinessPromotion>(`${this.endpoint}/business/${providerId}`, body).pipe(map((r) => r.data!));
  }

  updateBusiness(providerId: number, id: number, body: Partial<BusinessPromotionInput> & { isActive?: boolean }): Observable<BusinessPromotion> {
    return this._update<BusinessPromotion>(`${this.endpoint}/business/${providerId}`, id, body).pipe(map((r) => r.data!));
  }

  removeBusiness(providerId: number, id: number): Observable<unknown> {
    return this._delete(`${this.endpoint}/business/${providerId}`, id);
  }
}
