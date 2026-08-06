import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Category } from '../../core/models/category.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class CategoryService extends ApiBaseService {
  private readonly endpoint = 'admin/categories';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Category>> {
    return this.getPaginated<Category>(this.endpoint, query);
  }

  getById(id: number): Observable<ApiResponse<Category>> {
    return this.getById<Category>(this.endpoint, id);
  }

  create(data: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.create<Category>(this.endpoint, data);
  }

  update(id: number, data: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.update<Category>(this.endpoint, id, data);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.delete<void>(this.endpoint, id);
  }

  toggle(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/toggle`,
      {}
    );
  }
}
