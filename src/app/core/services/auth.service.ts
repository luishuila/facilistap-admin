import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';
import { User } from '../models/user.interface';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  ChangePasswordRequest,
  ResetPasswordRequest,
} from '../models/auth.interface';
import { ApiResponse } from '../models/api-response.interface';

@Injectable({ providedIn: 'root' })
export class AuthService extends ApiBaseService {
  private readonly AUTH_ENDPOINT = 'auth';
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'current_user';

  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUserFromStorage());
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    super();
  }

  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(
      `${this.baseUrl}/${this.AUTH_ENDPOINT}/login`,
      credentials
    ).pipe(
      map((response) => {
        if (response.success && response.data) {
          this.storeSession(response.data.token, response.data.refreshToken, response.data.user);
        }
        return response;
      })
    );
  }

  logout(): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${this.AUTH_ENDPOINT}/logout`,
      {}
    ).pipe(
      tap(() => this.clearSession())
    );
  }

  refreshToken(): Observable<ApiResponse<RefreshTokenResponse>> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    return this.http.post<ApiResponse<RefreshTokenResponse>>(
      `${this.baseUrl}/${this.AUTH_ENDPOINT}/refresh`,
      { refreshToken }
    ).pipe(
      map((response) => {
        if (response.success && response.data) {
          this.storeTokens(response.data.token, response.data.refreshToken);
        }
        return response;
      })
    );
  }

  changePassword(data: ChangePasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${this.AUTH_ENDPOINT}/change-password`,
      data
    );
  }

  resetPassword(data: ResetPasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/${this.AUTH_ENDPOINT}/reset-password`,
      data
    );
  }

  getProfile(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(
      `${this.baseUrl}/${this.AUTH_ENDPOINT}/me`
    ).pipe(
      map((response) => {
        if (response.success && response.data) {
          this.setCurrentUser(response.data);
        }
        return response;
      })
    );
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000;
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user) {
      return false;
    }
    const token = this.getToken();
    if (!token) {
      return false;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const permissions: string[] = payload.permissions ?? [];
      return permissions.includes(permission);
    } catch {
      return false;
    }
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    if (!user) {
      return false;
    }
    const token = this.getToken();
    if (!token) {
      return false;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role === role;
    } catch {
      return false;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private storeSession(token: string, refreshToken: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private storeTokens(token: string, refreshToken: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  private setCurrentUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
  }

  private loadUserFromStorage(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  }
}
