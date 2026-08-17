import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { StateCountry } from '../../core/models/state.interface';
import { PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class StateService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<StateCountry>> {
    const filters = { ...query.filters };
    if (query.filters?.['countryId']) {
      filters['countryId'] = query.filters['countryId'];
    }
    return this._getPaginated<StateCountry>(`${this.endpoint}/states`, { ...query, filters });
  }
}
