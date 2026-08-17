import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiBaseService } from '../../../core/services/api-base.service';

interface NestResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class DashboardService extends ApiBaseService {
  private readonly endpoint = 'admin/dashboard';

  getKpis(): Observable<any> {
    return this.http
      .get<NestResponse<any>>(`${this.baseUrl}/${this.endpoint}/kpis`)
      .pipe(map((res) => res.data));
  }

  getAlerts(): Observable<any[]> {
    return this.http
      .get<NestResponse<any>>(`${this.baseUrl}/${this.endpoint}/full`)
      .pipe(map((res) => res.data?.alerts ?? []));
  }

  getFull(): Observable<any> {
    return this.http
      .get<NestResponse<any>>(`${this.baseUrl}/${this.endpoint}/full`)
      .pipe(map((res) => res.data));
  }
}
