import { Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';
import { Broadcast, BroadcastAudience, SendBroadcast } from '../../../core/models/broadcast.interface';

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
}

@Injectable({ providedIn: 'root' })
export class BroadcastService extends ApiBaseService {
  // NotificationAdminController (/api/admin/notifications): solo SuperAdmin.
  private readonly endpoint = 'admin/notifications';

  history(query: PaginatedQuery): Observable<PaginatedResponse<Broadcast>> {
    return this._getPaginated<Broadcast>(this.endpoint, query);
  }

  countRecipients(audience: BroadcastAudience, role?: string, userIds?: string[]): Observable<number> {
    const params = this.buildHttpParams({ audience, role, userIds: userIds?.length ? userIds.join(',') : undefined });
    return this.http
      .get<ApiResponse<{ count: number }>>(`${this.baseUrl}/${this.endpoint}/recipients-count`, { params })
      .pipe(map((res) => res.data?.count ?? 0));
  }

  send(data: SendBroadcast): Observable<ApiResponse<Broadcast>> {
    return this._create<Broadcast>(this.endpoint, data);
  }

  /**
   * Sube la imagen directo a S3: el backend firma la URL (POST /upload/presign) y el
   * navegador hace el PUT. Devuelve la URL publica para guardar en el aviso.
   */
  uploadImage(file: File): Observable<string> {
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    return this.http
      .post<ApiResponse<PresignResponse>>(`${this.baseUrl}/admin/upload/presign`, {
        contentType: file.type,
        purpose: 'misc',
        extension: extension || undefined,
      })
      .pipe(
        switchMap((res) => {
          const presign = res.data!;
          return this.http
            .put(presign.uploadUrl, file, { headers: { 'Content-Type': file.type }, responseType: 'text' })
            .pipe(map(() => presign.publicUrl));
        }),
      );
  }
}
