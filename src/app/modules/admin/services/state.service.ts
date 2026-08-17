import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { StateCountry } from '../../../core/models/state.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class StateService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<StateCountry>> {
    const filters = { ...query.filters };
    if (query.filters?.['countryId']) {
      filters['countryId'] = query.filters['countryId'];
    }
    return this._getPaginated<StateCountry>('states', { ...query, filters });
  }
  getById(id: number): Observable<ApiResponse<StateCountry>> {
    return this._getById<StateCountry>('states', id);
  }
}
