import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { translationsLabel } from '../../../core/utils/localized-name.util';
import { City } from '../../../core/models/city.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class CityService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<City>> {
    return this._getPaginated<City>('cities', query).pipe(
      map((res) => ({ ...res, items: (res.items ?? []).map((i) => ({ ...i, translations: translationsLabel(i.localizedName) })) })),
    );
  }
  getById(id: number): Observable<ApiResponse<City>> {
    return this._getById<City>('cities', id);
  }
  // El listado sale del AdminController (/api/cities); el CRUD vive en
  // CitystateController (/api/citystate).
  create(data: unknown): Observable<ApiResponse<City>> {
    return this._create<City>('cities', data);
  }
  update(id: number, data: unknown): Observable<ApiResponse<City>> {
    return this._patch<City>('cities', id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>('cities', id);
  }
}
