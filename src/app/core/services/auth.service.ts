import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';

interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

export const SUPER_ADMIN_ONLY_MESSAGE = 'Su cuenta no tiene módulos asignados en el panel. Pida a un Super Administrador que le dé permisos.';

/** Que puede ver en el panel la cuenta logueada. */
export interface PanelAccess {
  superAdmin: boolean;
  modules: string[];
}

/**
 * Cuenta del PANEL (tabla admin_users del backend). No es un usuario de la app:
 * tiene su propio login, contraseña y token.
 */
export interface AdminProfile {
  id: string;
  name: string;
  lastname: string | null;
  email: string;
  phone: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface AdminLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  admin: AdminProfile;
  access: PanelAccess;
}

interface AdminRefreshResponse {
  access_token: string;
  refresh_token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService extends ApiBaseService {
  // Claves propias del panel: nunca se mezclan con una sesion de la app.
  private readonly TOKEN_KEY = 'admin_access_token';
  private readonly REFRESH_TOKEN_KEY = 'admin_refresh_token';
  private readonly USER_KEY = 'admin_profile';
  private readonly ACCESS_KEY = 'admin_panel_access';
  /** Claves del login anterior (usuarios de la app): se borran al cargar. */
  private readonly LEGACY_KEYS = ['access_token', 'refresh_token', 'current_user', 'panel_access'];

  private readonly platformId = inject(PLATFORM_ID);

  private currentUserSubject = new BehaviorSubject<AdminProfile | null>(this.loadFromStorage<AdminProfile>(this.USER_KEY));
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  private accessSubject = new BehaviorSubject<PanelAccess | null>(this.loadFromStorage<PanelAccess>(this.ACCESS_KEY));
  /** Modulos del panel permitidos; el menu y las rutas se arman con esto. */
  public readonly access$ = this.accessSubject.asObservable();

  constructor() {
    super();
    const storage = this.getStorage();
    this.LEGACY_KEYS.forEach((k) => storage?.removeItem(k));
  }

  private getStorage(): Storage | null {
    return isPlatformBrowser(this.platformId) ? localStorage : null;
  }

  /** Login del panel: email + contraseña de la cuenta admin (no la de la app). */
  login(credentials: { email: string; password: string }): Observable<AdminLoginResponse> {
    return this.http
      .post<ApiResponse<AdminLoginResponse>>(`${this.baseUrl}/admin/auth/login`, {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      })
      .pipe(
        map((response) => {
          const data = response.data;
          if (!response.success || !data?.access_token) {
            throw new Error(response.message || 'Email o contraseña incorrectos.');
          }
          this.storeSession(data.access_token, data.refresh_token, data.admin);
          this.storeAccess(data.access);
          return data;
        })
      );
  }

  /** Vuelve a pedir perfil y permisos (p. ej. si un Super Admin cambio sus modulos). */
  refreshAccess(): Observable<PanelAccess> {
    return this.http.get<ApiResponse<{ admin: AdminProfile; access: PanelAccess }>>(`${this.baseUrl}/admin/auth/me`).pipe(
      map((res) => {
        if (res.data?.admin) this.setCurrentUser(res.data.admin);
        return res.data?.access ?? { superAdmin: false, modules: [] };
      }),
      tap((access) => this.storeAccess(access))
    );
  }

  /** Cambio de contraseña de la propia cuenta del panel (cierra sus otras sesiones). */
  changePassword(currentPassword: string, newPassword: string): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/admin/auth/password`, { currentPassword, newPassword })
      .pipe(
        tap(() => {
          const profile = this.getCurrentUser();
          if (profile) this.setCurrentUser({ ...profile, mustChangePassword: false });
        })
      );
  }

  /** Tiene algo que ver en el panel (super admin o al menos un modulo). */
  hasPanelAccess(): boolean {
    const access = this.accessSubject.value;
    return !!access && (access.superAdmin || access.modules.length > 0);
  }

  /** Puede entrar al modulo del panel (`users`, `pqrs`...). */
  canAccess(module: string | undefined | null): boolean {
    if (!module) return true;
    const access = this.accessSubject.value;
    return !!access && (access.superAdmin || access.modules.includes(module));
  }

  isSuperAdmin(): boolean {
    return this.accessSubject.value?.superAdmin ?? this.getCurrentUser()?.isSuperAdmin ?? false;
  }

  /** Compatibilidad (guards/directivas antiguas): las cuentas del panel solo distinguen Super Admin. */
  hasRole(role: string): boolean {
    return ['SUPER_ADMIN', 'ADMIN'].includes((role ?? '').toUpperCase()) && this.isSuperAdmin();
  }

  /** Compatibilidad: `panel.users` o `users` -> modulo del panel. */
  hasPermission(permission: string): boolean {
    return this.canAccess((permission ?? '').replace(/^panel\./, ''));
  }

  /** Debe cambiar la contraseña antes de usar el panel (cuenta nueva o clave restablecida). */
  mustChangePassword(): boolean {
    return !!this.getCurrentUser()?.mustChangePassword;
  }

  /** Borra la sesion local sin llamar al backend (sesion invalida o sin permisos). */
  endLocalSession(): void {
    this.clearSession();
  }

  logout(): Observable<unknown> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/admin/auth/logout`, {}).pipe(
      catchError(() => of(null)),
      tap(() => this.clearSession())
    );
  }

  refreshToken(): Observable<ApiResponse<AdminRefreshResponse>> {
    const refreshToken = this.getStorage()?.getItem(this.REFRESH_TOKEN_KEY) ?? '';
    return this.http
      .post<ApiResponse<AdminRefreshResponse>>(`${this.baseUrl}/admin/auth/refresh`, { refresh_token: refreshToken })
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            this.storeTokens(response.data.access_token, response.data.refresh_token);
          }
          return response;
        })
      );
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return this.getStorage()?.getItem(this.TOKEN_KEY) ?? null;
  }

  getCurrentUser(): AdminProfile | null {
    return this.currentUserSubject.value;
  }

  private storeSession(accessToken: string, refreshToken: string, admin: AdminProfile): void {
    this.storeTokens(accessToken, refreshToken);
    this.setCurrentUser(admin);
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    const storage = this.getStorage();
    storage?.setItem(this.TOKEN_KEY, accessToken);
    storage?.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  private setCurrentUser(admin: AdminProfile): void {
    this.getStorage()?.setItem(this.USER_KEY, JSON.stringify(admin));
    this.currentUserSubject.next(admin);
  }

  private storeAccess(access: PanelAccess): void {
    this.getStorage()?.setItem(this.ACCESS_KEY, JSON.stringify(access));
    this.accessSubject.next(access);
  }

  private clearSession(): void {
    const storage = this.getStorage();
    [this.TOKEN_KEY, this.REFRESH_TOKEN_KEY, this.USER_KEY, this.ACCESS_KEY].forEach((k) => storage?.removeItem(k));
    this.currentUserSubject.next(null);
    this.accessSubject.next(null);
  }

  private loadFromStorage<T>(key: string): T | null {
    const stored = this.getStorage()?.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return null;
    }
  }
}
