import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { PQRS, PqrsResponse, PqrsFile, PqrsStatus } from '../../core/models/pqrs.interface';
import {
  ApiResponse,
  PaginatedResponse,
} from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class PqrsService extends ApiBaseService {
  private readonly endpoint = 'admin/pqrs';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<PQRS>> {
    return this.getPaginated<PQRS>(this.endpoint, query);
  }

  getById(id: number): Observable<ApiResponse<PQRS>> {
    return this.getById<PQRS>(this.endpoint, id);
  }

  create(data: Partial<PQRS>): Observable<ApiResponse<PQRS>> {
    return this.create<PQRS>(this.endpoint, data);
  }

  update(id: number, data: Partial<PQRS>): Observable<ApiResponse<PQRS>> {
    return this.update<PQRS>(this.endpoint, id, data);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.delete<void>(this.endpoint, id);
  }

  updateStatus(id: number, status: PqrsStatus): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/status`,
      { status }
    );
  }

  assign(id: number, userId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/assign`,
      { userId }
    );
  }

  respond(id: number, response: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/respond`,
      { response }
    );
  }

  uploadFile(id: number, formData: FormData): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${this.endpoint}/${id}/upload`,
      formData
    );
  }

  getResponses(id: number): Observable<ApiResponse<PqrsResponse[]>> {
    return this.http.get<ApiResponse<PqrsResponse[]>>(
      `${this.baseUrl}/${this.endpoint}/${id}/responses`
    );
  }

  getFiles(id: number): Observable<ApiResponse<PqrsFile[]>> {
    return this.http.get<ApiResponse<PqrsFile[]>>(
      `${this.baseUrl}/${this.endpoint}/${id}/files`
    );
  }
}
