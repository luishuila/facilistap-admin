import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { City } from '../../../core/models/city.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class CityService extends ApiBaseService {
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<City>> {
    return this._getPaginated<City>('cities', query);
  }
  getById(id: number): Observable<ApiResponse<City>> {
    return this._getById<City>('cities', id);
  }
}
