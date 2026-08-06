import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import {
  SystemSetting,
  NotificationConfig,
  SecurityConfig,
  AuthConfig,
} from '../../core/models/settings.interface';
import { ApiResponse } from '../../core/models/api-response.interface';

@Injectable({ providedIn: 'root' })
export class SettingsService extends ApiBaseService {
  private readonly endpoint = 'admin/settings';

  getAll(): Observable<ApiResponse<SystemSetting[]>> {
    return this.http.get<ApiResponse<SystemSetting[]>>(
      `${this.baseUrl}/${this.endpoint}`
    );
  }

  getById(id: number): Observable<ApiResponse<SystemSetting>> {
    return this._getById<SystemSetting>(this.endpoint, id);
  }

  update(id: number, data: Partial<SystemSetting>): Observable<ApiResponse<SystemSetting>> {
    return this._update<SystemSetting>(this.endpoint, id, data);
  }

  getByGroup(group: string): Observable<ApiResponse<SystemSetting[]>> {
    return this.http.get<ApiResponse<SystemSetting[]>>(
      `${this.baseUrl}/${this.endpoint}/group/${group}`
    );
  }

  getNotificationConfig(): Observable<ApiResponse<NotificationConfig>> {
    return this.http.get<ApiResponse<NotificationConfig>>(
      `${this.baseUrl}/${this.endpoint}/notifications`
    );
  }

  updateNotificationConfig(data: NotificationConfig): Observable<ApiResponse<NotificationConfig>> {
    return this.http.put<ApiResponse<NotificationConfig>>(
      `${this.baseUrl}/${this.endpoint}/notifications`,
      data
    );
  }

  getSecurityConfig(): Observable<ApiResponse<SecurityConfig>> {
    return this.http.get<ApiResponse<SecurityConfig>>(
      `${this.baseUrl}/${this.endpoint}/security`
    );
  }

  updateSecurityConfig(data: SecurityConfig): Observable<ApiResponse<SecurityConfig>> {
    return this.http.put<ApiResponse<SecurityConfig>>(
      `${this.baseUrl}/${this.endpoint}/security`,
      data
    );
  }

  getAuthConfig(): Observable<ApiResponse<AuthConfig>> {
    return this.http.get<ApiResponse<AuthConfig>>(
      `${this.baseUrl}/${this.endpoint}/auth`
    );
  }

  updateAuthConfig(data: AuthConfig): Observable<ApiResponse<AuthConfig>> {
    return this.http.put<ApiResponse<AuthConfig>>(
      `${this.baseUrl}/${this.endpoint}/auth`,
      data
    );
  }
}
