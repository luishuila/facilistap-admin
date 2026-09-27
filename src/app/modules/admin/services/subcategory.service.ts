import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Subcategory, SubcategoryPayload } from '../../../core/models/subcategory.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class SubcategoryService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Subcategory>> {
    return this._getPaginated<Subcategory>('subcategories', query);
  }
  getById(id: number): Observable<ApiResponse<Subcategory>> {
    return this._getById<Subcategory>('subcategories', id);
  }
  create(data: SubcategoryPayload): Observable<ApiResponse<Subcategory>> {
    return this._create<Subcategory>('subcategories', data);
  }
  update(id: number, data: Partial<SubcategoryPayload>): Observable<ApiResponse<Subcategory>> {
    return this._patch<Subcategory>('subcategories', id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>('subcategories', id);
  }
  toggle(id: number): Observable<ApiResponse<Subcategory>> {
    return this.http.patch<ApiResponse<Subcategory>>(`${this.baseUrl}/subcategories/${id}/toggle`, {});
  }
}
