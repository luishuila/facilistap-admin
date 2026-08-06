import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';
import type { User } from '../models/user.interface';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  ChangePasswordRequest,
  ResetPasswordRequest,
} from '../models/auth.interface';

interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class AuthService extends ApiBaseService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'current_user';

  private readonly platformId = inject(PLATFORM_ID);

  private currentUserSubject = new BehaviorSubject<User | null>(
    this.loadUserFromStorage()
  );
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  private getStorage(): Storage | null {
    return isPlatformBrowser(this.platformId) ? localStorage : null;
  }

  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http
      .post<ApiResponse<LoginResponse>>(
        `${this.baseUrl}/auth/login`,
        credentials
      )
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            this.storeSession(
              response.data.access_token,
              response.data.refresh_token,
              response.data.user
            );
          }
          return response;
        })
      );
  }

  logout(): Observable<ApiResponse<void>> {
    return this.http
      .post<ApiResponse<void>>(`${this.baseUrl}/auth/logout`, {})
      .pipe(tap(() => this.clearSession()));
  }

  refreshToken(): Observable<ApiResponse<RefreshTokenResponse>> {
    const storage = this.getStorage();
    const refreshToken = storage?.getItem(this.REFRESH_TOKEN_KEY) ?? '';
    return this.http
      .post<ApiResponse<RefreshTokenResponse>>(
        `${this.baseUrl}/auth/refresh`,
        { refresh_token: refreshToken }
      )
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            this.storeTokens(
              response.data.access_token,
              response.data.refresh_token
            );
          }
          return response;
        })
      );
  }

  changePassword(data: ChangePasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/auth/password/change`,
      data
    );
  }

  resetPassword(data: ResetPasswordRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/auth/password/reset`,
      data
    );
  }

  getProfile(): Observable<ApiResponse<User>> {
    return this.http
      .get<ApiResponse<User>>(`${this.baseUrl}/auth/session/status`)
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            this.setCurrentUser(response.data);
          }
          return response;
        })
      );
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    if (!user?.roles) return false;
    return user.roles.some((r) => r.role === role || r.name === role);
  }

  hasPermission(permission: string): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const permissions: string[] = payload.permissions ?? [];
      return permissions.includes(permission);
    } catch {
      return false;
    }
  }

  getToken(): string | null {
    return this.getStorage()?.getItem(this.TOKEN_KEY) ?? null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private storeSession(
    accessToken: string,
    refreshToken: string,
    user: User
  ): void {
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(this.TOKEN_KEY, accessToken);
      storage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      storage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(this.TOKEN_KEY, accessToken);
      storage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  private setCurrentUser(user: User): void {
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
  }

  private clearSession(): void {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(this.TOKEN_KEY);
      storage.removeItem(this.REFRESH_TOKEN_KEY);
      storage.removeItem(this.USER_KEY);
    }
    this.currentUserSubject.next(null);
  }

  private loadUserFromStorage(): User | null {
    const storage = this.getStorage();
    if (!storage) return null;
    const stored = storage.getItem(this.USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  }
}
