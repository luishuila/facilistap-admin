import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiBaseService } from '../../../../core/services/api-base.service';

interface NestResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
}

export interface VisitCount {
  visits: number;
  visitors: number;
}

export interface SiteVisitStats {
  days: number;
  today: VisitCount;
  last7: VisitCount;
  last30: VisitCount;
  total: VisitCount;
  byDay: Array<VisitCount & { date: string }>;
  byPlatform: Array<VisitCount & { platform: string }>;
  topReferrers: Array<{ referrer: string; visits: number }>;
  audience: { withSession: number; withoutSession: number };
}

@Injectable({ providedIn: 'root' })
export class DashboardService extends ApiBaseService {
  // Dashboard del panel (token de admin): toda la plataforma.
  private readonly endpoint = 'admin/panel-dashboard';

  getKpis(): Observable<any> {
    return this.http
      .get<NestResponse<any>>(`${this.baseUrl}/${this.endpoint}/kpis`)
      .pipe(map((res) => res.data));
  }

  getAlerts(): Observable<any[]> {
    return this.http
      .get<NestResponse<any[]>>(`${this.baseUrl}/${this.endpoint}/activity`)
      .pipe(map((res) => res.data ?? []));
  }

  /** Visitas de la página web y la app (últimos `days` días). */
  getSiteVisits(days = 30): Observable<SiteVisitStats> {
    return this.http
      .get<NestResponse<SiteVisitStats>>(`${this.baseUrl}/admin/site-visits`, { params: { days } })
      .pipe(map((res) => res.data as SiteVisitStats));
  }

  getFull(): Observable<any> {
    return this.http
      .get<NestResponse<any>>(`${this.baseUrl}/${this.endpoint}/full`)
      .pipe(map((res) => res.data));
  }
}
