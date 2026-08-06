import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Subcategory } from '../../core/models/subcategory.interface';
import { ApiResponse, PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class SubcategoryService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Subcategory>> {
    return this._getPaginated<Subcategory>(`${this.endpoint}/subcategories`, query);
  }
  getById(id: number): Observable<ApiResponse<Subcategory>> {
    return this._getById<Subcategory>(`${this.endpoint}/subcategories`, id);
  }
  create(data: Partial<Subcategory>): Observable<ApiResponse<Subcategory>> {
    return this._create<Subcategory>(`${this.endpoint}/subcategories`, data);
  }
  update(id: number, data: Partial<Subcategory>): Observable<ApiResponse<Subcategory>> {
    return this._patch<Subcategory>(`${this.endpoint}/subcategories`, id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(`${this.endpoint}/subcategories`, id);
  }
  toggle(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/subcategories/${id}`, {});
  }
  getByCategory(categoryId: number): Observable<ApiResponse<Subcategory[]>> {
    return this.http.get<ApiResponse<Subcategory[]>>(`${this.baseUrl}/${this.endpoint}/subcategories?categoryId=${categoryId}`);
  }
}
