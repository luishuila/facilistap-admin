import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { translationsLabel } from '../../../core/utils/localized-name.util';
import { StateCountry } from '../../../core/models/state.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class StateService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<StateCountry>> {
    // El backend filtra por `countryCode` (columna de state_countries).
    return this._getPaginated<StateCountry>('states', query).pipe(
      map((res) => ({ ...res, items: (res.items ?? []).map((i) => ({ ...i, translations: translationsLabel(i.localizedName) })) })),
    );
  }
  getById(id: number): Observable<ApiResponse<StateCountry>> {
    return this._getById<StateCountry>('states', id);
  }
  // El listado sale del AdminController (/api/states); el CRUD vive en
  // StateCountryController (/api/statecountry).
  create(data: unknown): Observable<ApiResponse<StateCountry>> {
    return this._create<StateCountry>('states', data);
  }
  update(id: number, data: unknown): Observable<ApiResponse<StateCountry>> {
    return this._update<StateCountry>('states', id, data);
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>('states', id);
  }
}
