import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Country } from '../../../core/models/country.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class CountryService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Country>> {
    return this._getPaginated<Country>('countries', query);
  }
  getById(id: number): Observable<ApiResponse<Country>> {
    return this._getById<Country>('countries', id);
  }
}
