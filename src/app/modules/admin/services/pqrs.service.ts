import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';
import { ApiBaseService } from '../../../core/services/api-base.service';
import { Complaint, ComplaintAdmin, ComplaintNote, ComplaintStatus } from '../../../core/models/complaint.interface';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.interface';
import { PaginatedQuery } from '../../../core/models/paginated-query.interface';

@Injectable({ providedIn: 'root' })
export class PqrsService extends ApiBaseService {
  // ComplaintAdminController (/api/admin/complaints): token del panel + modulo PQRS.
  private readonly endpoint = 'admin/complaints';
  private reasonLabels$?: Observable<Record<string, string>>;

  // El backend devuelve un array (sin paginar); filtramos/ordenamos/paginamos en el cliente.
  getAll(query: PaginatedQuery): Observable<PaginatedResponse<Complaint>> {
    return forkJoin([this._getAll<Complaint>(this.endpoint), this.getReasonLabels()]).pipe(
      map(([res, labels]) => {
        let items = (res.data ?? []).map((c) => this.withDisplayFields(c, labels));
        const filters = query.filters ?? {};
        const term = (query.search ?? '').trim().toLowerCase();
        if (term) {
          items = items.filter((c) =>
            [c.reason, c.reasonLabel, c.description, c.userName, c.user?.email].some((v) =>
              (v ?? '').toLowerCase().includes(term),
            ),
          );
        }
        if (filters['status']) items = items.filter((c) => c.status === filters['status']);
        if (filters['type']) items = items.filter((c) => c.type === filters['type']);
        if (filters['dateFrom']) items = items.filter((c) => c.createdAt.slice(0, 10) >= String(filters['dateFrom']));
        if (filters['dateTo']) items = items.filter((c) => c.createdAt.slice(0, 10) <= String(filters['dateTo']));

        const sortBy = (query.sortBy ?? 'createdAt') as keyof Complaint;
        const dir = query.sortOrder === 'asc' ? 1 : -1;
        items = [...items].sort((a, b) => String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), undefined, { numeric: true }) * dir);

        const total = items.length;
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        return {
          items: items.slice((page - 1) * limit, page * limit),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }),
    );
  }
  getById(id: number): Observable<ApiResponse<Complaint>> {
    return this.getReasonLabels().pipe(
      switchMap((labels) =>
        this._getById<Complaint>(this.endpoint, id).pipe(
          map((res) => ({ ...res, data: res.data ? this.withDisplayFields(res.data, labels) : res.data })),
        ),
      ),
    );
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this._delete<void>(this.endpoint, id);
  }
  // UpdateComplaintDto: { status?, adminNote? }
  changeStatus(id: number, status: ComplaintStatus): Observable<ApiResponse<Complaint>> {
    return this._patch<Complaint>(this.endpoint, id, { status });
  }
  /** Toma la PQRS: queda En proceso con `assigneeId` (o quien la toma) como responsable; avisa al usuario. */
  take(id: number, assigneeId?: string): Observable<ApiResponse<Complaint>> {
    return this._create<Complaint>(`${this.endpoint}/${id}/take`, assigneeId ? { assigneeId } : {});
  }
  /** Super administradores que pueden quedar como responsables. */
  getAdmins(): Observable<ComplaintAdmin[]> {
    return this._getAll<ComplaintAdmin>(`${this.endpoint}/admins/list`).pipe(map((res) => res.data ?? []));
  }
  /** Las imagenes llegan como URL publica (S3) o como ruta local del backend (/uploads/...). */
  imageUrl(path: string): string {
    if (!path) return '';
    if (/^(https?:|data:)/i.test(path)) return path;
    const origin = this.baseUrl.replace(/\/api$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  // POST /complaints/:id/notes: { note }
  respond(id: number, note: string): Observable<ApiResponse<ComplaintNote>> {
    return this.http.post<ApiResponse<ComplaintNote>>(`${this.baseUrl}/${this.endpoint}/${id}/notes`, { note });
  }

  /**
   * Codigo -> nombre de los motivos (maestra COMPLAINT_REASON_*), en el idioma del navegador.
   * Si falla, la tabla muestra el codigo.
   */
  private getReasonLabels(): Observable<Record<string, string>> {
    this.reasonLabels$ ??= forkJoin(
      ['COMPLAINT_REASON_COMPLAINT', 'COMPLAINT_REASON_CLAIM', 'COMPLAINT_REASON_REPORT'].map((group) =>
        this._getAll<{ value: string; label: string }>(`maestra/group/${group}`).pipe(
          map((res) => res.data ?? []),
          catchError(() => of([] as { value: string; label: string }[])),
        ),
      ),
    ).pipe(
      map((groups) => Object.fromEntries(groups.flat().map((o) => [o.value, o.label]))),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.reasonLabels$;
  }

  private withDisplayFields(c: Complaint, labels: Record<string, string> = {}): Complaint {
    const userName = [c.user?.name, c.user?.lastname].filter(Boolean).join(' ') || c.user?.username || '';
    const notes = c.notes ?? [];
    const last = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    // Pendiente sin tomar, o el usuario fue el ultimo en escribir: hay que atenderla.
    const awaitingReply = c.status !== 'resolved' && (c.status === 'pending' || last?.authorRole === 'user') ? 'YES' : 'NO';
    return { ...c, userName, reasonLabel: labels[c.reason] ?? c.reason, images: c.images ?? [], notes, awaitingReply };
  }
}
