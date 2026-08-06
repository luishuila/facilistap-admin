import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { PQRS, PqrsResponse, PqrsFile } from '../../core/models/pqrs.interface';
import { ApiResponse, PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class PqrsService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<PQRS>> {
    return this._getPaginated<PQRS>(`${this.endpoint}/complaints`, query);
  }
  getById(id: number): Observable<ApiResponse<PQRS>> {
    return this._getById<PQRS>(`${this.endpoint}/complaints`, id);
  }
  create(data: Partial<PQRS>): Observable<ApiResponse<PQRS>> {
    return this._create<PQRS>(`${this.endpoint}/complaints`, data);
  }
  update(id: number, data: Partial<PQRS>): Observable<ApiResponse<PQRS>> {
    return this._patch<PQRS>(`${this.endpoint}/complaints`, id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(`${this.endpoint}/complaints`, id);
  }
  respond(id: number, note: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${this.endpoint}/complaints/${id}/notes`, { note });
  }
  changeStatus(id: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/${this.endpoint}/complaints/${id}`, { status });
  }
  assign(id: number, userId: number): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/${this.endpoint}/complaints/${id}`, { assignedTo: userId });
  }
  uploadFile(id: number, formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/${this.endpoint}/complaints/${id}/upload`, formData);
  }
  getResponses(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/${this.endpoint}/complaints/${id}/notes`);
  }
  getFiles(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/${this.endpoint}/complaints/${id}/files`);
  }
}
