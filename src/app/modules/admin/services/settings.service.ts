import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse } from '../../../core/models/api-response.interface';
import {
  AppProperty,
  AppPropertyCategory,
  AppPropertyEnvironment,
  UpdateAppProperty,
} from '../../../core/models/app-property.interface';

@Injectable({ providedIn: 'root' })
export class SettingsService extends ApiBaseService {
  // AppPropertyController (/api/admin/settings): listar y editar exigen SuperAdmin.
  private readonly endpoint = 'admin/settings';

  /** El entorno va en la cabecera `x-app-environment`, no en la URL. */
  getAll(environment?: AppPropertyEnvironment, category?: AppPropertyCategory): Observable<ApiResponse<AppProperty[]>> {
    const headers = environment ? { 'x-app-environment': environment } : undefined;
    return this._getAll<AppProperty>(this.endpoint, { category }, headers);
  }
  update(id: number, data: UpdateAppProperty): Observable<ApiResponse<AppProperty>> {
    return this._patch<AppProperty>(this.endpoint, id, data);
  }
}
