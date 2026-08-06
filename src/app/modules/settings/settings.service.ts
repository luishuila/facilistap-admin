import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';

@Injectable({ providedIn: 'root' })
export class SettingsService extends ApiBaseService {
  getAll(_group?: unknown): Observable<any> {
    return of({ data: [] });
  }
  getById(_id?: unknown): Observable<any> {
    return of({ data: null });
  }
  update(_id?: unknown, _data?: unknown): Observable<any> {
    return of({ data: null });
  }
  getByGroup(_group?: unknown): Observable<any> {
    return of({ data: [] });
  }
  getNotificationConfig(): Observable<any> {
    return of({ data: { emailEnabled: false, smsEnabled: false, pushEnabled: false } });
  }
  updateNotificationConfig(_data?: unknown): Observable<any> {
    return of({ data: null });
  }
  getSecurityConfig(): Observable<any> {
    return of({ data: { maxLoginAttempts: 5, sessionTimeout: 30, passwordMinLength: 8, requireMfa: false } });
  }
  updateSecurityConfig(_data?: unknown): Observable<any> {
    return of({ data: null });
  }
  getAuthConfig(): Observable<any> {
    return of({ data: { jwtSecret: '', jwtExpiration: '30m', refreshTokenExpiration: '7d' } });
  }
  updateAuthConfig(_data?: unknown): Observable<any> {
    return of({ data: null });
  }
}
