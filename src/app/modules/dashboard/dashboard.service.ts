import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { DashboardStats, Activity } from '../../core/models/dashboard.interface';
import { ApiResponse } from '../../core/models/api-response.interface';

@Injectable({ providedIn: 'root' })
export class DashboardService extends ApiBaseService {
  private readonly endpoint = 'admin/dashboard';

  getStats(): Observable<ApiResponse<DashboardStats>> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.baseUrl}/${this.endpoint}/stats`);
  }

  getCharts(): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.baseUrl}/${this.endpoint}/charts`);
  }

  getActivity(): Observable<ApiResponse<Activity[]>> {
    return this.http.get<ApiResponse<Activity[]>>(`${this.baseUrl}/${this.endpoint}/activity`);
  }
}
