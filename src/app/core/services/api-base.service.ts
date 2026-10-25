import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedResponse } from '../models/api-response.interface';
import type { PaginatedQuery } from '../models/paginated-query.interface';

interface NestResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export abstract class ApiBaseService {
  protected http = inject(HttpClient);
  protected baseUrl = environment.apiUrl.replace(/\/$/, '');

  protected _getAll<T>(
    endpoint: string,
    params?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Observable<ApiResponse<T[]>> {
    const httpParams = this.buildHttpParams(params);
    return this.http.get<NestResponse<T[]>>(`${this.baseUrl}/${endpoint}`, { params: httpParams, headers }).pipe(
      map((res) => ({ success: res.success, statusCode: res.statusCode, message: res.message, data: res.data })),
      catchError((error) => this.handleError(error)),
    );
  }

  protected _getById<T>(endpoint: string, id: number | string): Observable<ApiResponse<T>> {
    return this.http.get<NestResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`).pipe(
      map((res) => ({ success: res.success, statusCode: res.statusCode, message: res.message, data: res.data })),
      catchError((error) => this.handleError(error)),
    );
  }

  protected _search<T>(endpoint: string, params?: Record<string, unknown>): Observable<ApiResponse<T[]>> {
    const httpParams = this.buildHttpParams(params);
    return this.http.get<NestResponse<T[]>>(`${this.baseUrl}/${endpoint}/search`, { params: httpParams }).pipe(
      map((res) => ({ success: res.success, statusCode: res.statusCode, message: res.message, data: res.data })),
      catchError((error) => this.handleError(error)),
    );
  }

  protected _create<T>(endpoint: string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.post<NestResponse<T>>(`${this.baseUrl}/${endpoint}`, body).pipe(
      map((res) => ({ success: res.success, statusCode: res.statusCode, message: res.message, data: res.data })),
      catchError((error) => this.handleError(error)),
    );
  }

  protected _update<T>(endpoint: string, id: number | string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.put<NestResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`, body).pipe(
      map((res) => ({ success: res.success, statusCode: res.statusCode, message: res.message, data: res.data })),
      catchError((error) => this.handleError(error)),
    );
  }

  protected _patch<T>(endpoint: string, id: number | string, body: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<NestResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`, body).pipe(
      map((res) => ({ success: res.success, statusCode: res.statusCode, message: res.message, data: res.data })),
      catchError((error) => this.handleError(error)),
    );
  }

  protected _delete<T>(endpoint: string, id: number | string): Observable<ApiResponse<T>> {
    return this.http.delete<NestResponse<T>>(`${this.baseUrl}/${endpoint}/${id}`).pipe(
      map((res) => ({ success: res.success, statusCode: res.statusCode, message: res.message, data: res.data })),
      catchError((error) => this.handleError(error)),
    );
  }

  protected _getPaginated<T>(endpoint: string, query: PaginatedQuery): Observable<PaginatedResponse<T>> {
    const params = this.buildHttpParams({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder?.toUpperCase(),
      search: query.search,
      ...(query.filters ?? {}),
    });
    return this.http.get<NestResponse<PaginatedResponse<T>>>(`${this.baseUrl}/${endpoint}`, { params }).pipe(
      map((res) => res.data ?? { items: [], total: 0, page: 1, limit: 10, totalPages: 0 }),
      catchError((error) => this.handleError(error)),
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
