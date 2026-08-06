import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Category } from '../../core/models/category.interface';
import { ApiResponse, PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class CategoryService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Category>> {
    return this._getPaginated<Category>(`${this.endpoint}/categories`, query);
  }
  getById(id: number): Observable<ApiResponse<Category>> {
    return this._getById<Category>(`${this.endpoint}/categories`, id);
  }
  create(data: Partial<Category>): Observable<ApiResponse<Category>> {
    return this._create<Category>(`${this.endpoint}/categories`, data);
  }
  update(id: number, data: Partial<Category>): Observable<ApiResponse<Category>> {
    return this._patch<Category>(`${this.endpoint}/categories`, id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(`${this.endpoint}/categories`, id);
  }
  toggle(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${this.endpoint}/categories/${id}`, {});
  }
}
