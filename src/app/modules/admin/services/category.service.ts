import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Category, CategoryPayload } from '../../../core/models/category.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService extends ApiBaseService {
  // Cliente sin interceptores: el PUT a S3 no debe llevar el Authorization del API
  private readonly s3Http = new HttpClient(inject(HttpBackend));

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Category>> {
    return this._getPaginated<Category>('categories', query);
  }
  getById(id: number): Observable<ApiResponse<Category>> {
    return this._getById<Category>('categories', id);
  }
  create(data: CategoryPayload): Observable<ApiResponse<Category>> {
    return this._create<Category>('categories', data);
  }
  update(id: number, data: Partial<CategoryPayload>): Observable<ApiResponse<Category>> {
    return this._patch<Category>('categories', id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>('categories', id);
  }
  toggle(id: number): Observable<ApiResponse<Category>> {
    return this.http.patch<ApiResponse<Category>>(`${this.baseUrl}/categories/${id}/toggle`, {});
  }

  /** Sube la imagen a S3 con URL prefirmada y devuelve la URL publica. */
  uploadImage(file: File): Observable<string> {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
    return this.http
      .post<{ data?: PresignedUpload } & Partial<PresignedUpload>>(`${this.baseUrl}/admin/upload/presign`, {
        contentType: file.type,
        purpose: 'category',
        extension,
      })
      .pipe(
        map((res) => (res.data ?? res) as PresignedUpload),
        switchMap((presigned) =>
          this.s3Http
            .put(presigned.uploadUrl, file, { headers: { 'Content-Type': file.type } })
            .pipe(map(() => presigned.publicUrl)),
        ),
      );
  }
}
