import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Subcategory } from '../../core/models/subcategory.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class SubcategoryService extends ApiBaseService {
  private readonly endpoint = 'admin/subcategories';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Subcategory>> {
    return this._getPaginated<Subcategory>(this.endpoint, query);
  }

  getById(id: number): Observable<ApiResponse<Subcategory>> {
    return this._getById<Subcategory>(this.endpoint, id);
  }

  create(data: Partial<Subcategory>): Observable<ApiResponse<Subcategory>> {
    return this._create<Subcategory>(this.endpoint, data);
  }

  update(id: number, data: Partial<Subcategory>): Observable<ApiResponse<Subcategory>> {
    return this._update<Subcategory>(this.endpoint, id, data);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(this.endpoint, id);
  }

  toggle(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/toggle`,
      {}
    );
  }

  getByCategory(categoryId: number): Observable<ApiResponse<Subcategory[]>> {
    return this.http.get<ApiResponse<Subcategory[]>>(
      `${this.baseUrl}/${this.endpoint}/by-category/${categoryId}`
    );
  }
}
