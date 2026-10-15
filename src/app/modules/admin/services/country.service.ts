import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { translationsLabel } from '../../../core/utils/localized-name.util';
import { Country } from '../../../core/models/country.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class CountryService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Country>> {
    return this._getPaginated<Country>('countries', query).pipe(
      map((res) => ({ ...res, items: (res.items ?? []).map((i) => ({ ...i, translations: translationsLabel(i.localizedName) })) })),
    );
  }
  getById(id: number): Observable<ApiResponse<Country>> {
    return this._getById<Country>('countries', id);
  }
  // Listado y CRUD en CountryAdminController (/api/countries, token del panel).

  create(data: unknown): Observable<ApiResponse<Country>> {
    return this._create<Country>('countries', data);
  }
  update(id: number, data: unknown): Observable<ApiResponse<Country>> {
    return this._update<Country>('countries', id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>('countries', id);
  }
}
