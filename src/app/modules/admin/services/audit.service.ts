import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';

@Injectable({ providedIn: 'root' })
export class AuditService extends ApiBaseService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll(_query?: unknown): Observable<any> {
    return of({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getById(_id?: unknown): Observable<any> {
    return of({ data: null });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export(_query?: unknown): Observable<any> {
    return of(new Blob());
  }
}
