import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse, PaginatedResponse } from '../models/api-response.interface';
import { PaginatedQuery } from '../models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export abstract class ApiBaseService {
  protected http = inject(HttpClient);
  protected baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;

  protected getAll<T>(endpoint: string, params?: Record<string, unknown>): Observable<ApiResponse<T[]>> {
    const httpParams = this.buildHttpParams(params);
    return this.http.get<ApiResponse<T[]>>(`${this.baseUrl}/${endpoint}`, { params: httpParams }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected getById<T>(endpoint: string, id: number | string): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected search<T>(endpoint: string, params?: Record<string, unknown>): Observable<ApiResponse<T[]>> {
    const httpParams = this.buildHttpParams(params);
    return this.http.get<ApiResponse<T[]>>(`${this.baseUrl}/${endpoint}/search`, { params: httpParams }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected create<T>(endpoint: string, data: unknown): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}/${endpoint}`, data).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected update<T>(endpoint: string, id: number | string, data: unknown): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`, data).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected patch<T>(endpoint: string, id: number | string, data: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`, data).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected delete<T>(endpoint: string, id: number | string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected getPaginated<T>(endpoint: string, query: PaginatedQuery): Observable<PaginatedResponse<T>> {
    const params = this.buildHttpParams({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      search: query.search,
      ...(query.filters ?? {}),
    });
    return this.http.get<PaginatedResponse<T>>(`${this.baseUrl}/${endpoint}`, { params }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  protected buildHttpParams(params?: Record<string, unknown>): HttpParams {
    let httpParams = new HttpParams();
    if (!params) {
      return httpParams;
    }
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  protected handleError(error: unknown): Observable<never> {
    let message = 'An unexpected error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    console.error('[ApiBaseService]', message, error);
    return throwError(() => new Error(message));
  }
}
