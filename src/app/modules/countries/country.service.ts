import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { Country } from '../../core/models/country.interface';
import { PaginatedResponse } from '../../core/models/api-response.interface';
import { PaginatedQuery } from '../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class CountryService extends ApiBaseService {
  private readonly endpoint = 'admin';

  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Country>> {
    return this._getPaginated<Country>(`${this.endpoint}/countries`, query);
  }
}
