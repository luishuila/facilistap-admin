import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Observable, finalize } from 'rxjs';

import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { VerificationItem, VerificationService } from '../../services/verification.service';

interface DocView {
  label: string;
  isPdf: boolean;
  url: string | null;
  error: boolean;
}

/** Revisión de una solicitud: documentos, aprobar, rechazar con motivo o quitar la insignia. */
@Component({
  selector: 'app-verification-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>verified</mat-icon></div>
        <div class="header-text">
          <h2>Revisar verificación</h2>
          @if (item(); as v) {
            <p>
              {{ v.subjectType === 'PROVIDER' ? 'Proveedor' : 'Usuario' }} ·
              <strong>{{ v.subjectType === 'PROVIDER' ? v.providerName : v.userName }}</strong>
              @if (v.subjectType === 'PROVIDER') { <span> · dueño {{ v.userName }}</span> }
            </p>
          }
        </div>
        @if (item(); as v) {
          <span class="status" [ngClass]="'st-' + v.status">{{ statusLabel(v.status) }}</span>
        }
      </div>

      @if (!item()) {
        <div class="center"><mat-spinner diameter="32"></mat-spinner></div>
      } @else {
        @let v = item()!;
        <div class="meta">
          <div><span>Usuario</span><strong>{{ v.username ? '@' + v.username : '—' }}</strong></div>
          <div><span>Email</span><strong>{{ v.userEmail || '—' }}</strong></div>
          <div><span>Enviada</span><strong>{{ v.createdAt | date: 'dd/MM/yyyy HH:mm' }}</strong></div>
          <div><span>Aceptó términos</span><strong>{{ v.termsAcceptedAt | date: 'dd/MM/yyyy HH:mm' }}</strong></div>
          <div><span>Pago</span><strong>
            @if (v.status === 'PENDING' && !v.paidAt) {
              Al aprobar, el usuario elige plan
            } @else if (v.status === 'AWAITING_PAYMENT' && !v.planCode) {
              Plan por elegir · sin pagar
            } @else {
              {{ v.amount > 0 ? (v.currency + ' ' + (v.amount | number: '1.0-0')) : 'Gratis' }} · {{ v.paidAt ? ('pagado ' + (v.paidAt | date: 'dd/MM/yyyy')) : 'sin pagar' }}
            }
          </strong></div>
          @if (v.planMonths) {
            <div><span>Plan</span><strong>{{ v.planMonths === 12 ? '1 año' : v.planMonths === 1 ? '1 mes' : v.planMonths + ' meses' }}</strong></div>
          }
          @if (v.payBefore) {
            <div><span>Debe pagar antes del</span><strong>{{ v.payBefore | date: 'dd/MM/yyyy HH:mm' }}</strong></div>
          } @else if (v.expiresAt && v.status === 'APPROVED') {
            <div><span>Insignia vigente hasta</span><strong>{{ v.expiresAt | date: 'dd/MM/yyyy' }}</strong></div>
          }
          @if (v.reviewedAt) {
            <div><span>Revisó</span><strong>{{ v.reviewedByName }} · {{ v.reviewedAt | date: 'dd/MM/yyyy HH:mm' }}</strong></div>
          }
        </div>

        @if (v.status === 'REJECTED' && v.rejectionReason) {
          <div class="reason"><mat-icon>info</mat-icon><span>Motivo del rechazo: {{ v.rejectionReason }}</span></div>
        }

        <h3 class="docs-title">Documentos</h3>
        <div class="docs">
          @for (d of docs(); track $index) {
            <div class="doc">
              <div class="doc-view" [class.clickable]="!!d.url" (click)="open(d)">
                @if (d.error) {
                  <mat-icon class="muted">broken_image</mat-icon>
                } @else if (!d.url) {
                  <mat-spinner diameter="24"></mat-spinner>
                } @else if (d.isPdf) {
                  <mat-icon class="pdf">picture_as_pdf</mat-icon>
                  <small>Abrir PDF</small>
                } @else {
                  <img [src]="d.url" [alt]="d.label" />
                }
              </div>
              <span class="doc-label">{{ d.label }}</span>
            </div>
          }
        </div>

        @if (v.status === 'PENDING' && rejecting()) {
          <mat-form-field appearance="outline" class="full">
            <mat-label>Motivo del rechazo (lo verá el usuario)</mat-label>
            <textarea matInput rows="3" [(ngModel)]="reason" maxlength="1000"
              placeholder="Ej: La foto del documento está borrosa; súbala de nuevo con buena luz."></textarea>
            <mat-hint>Obligatorio (mínimo 5 caracteres). Le llega al usuario en la campana y en su pantalla de verificación.</mat-hint>
          </mat-form-field>
          <!-- Motivos frecuentes: un toque y se puede editar -->
          <div class="quick-reasons">
            @for (q of quickReasons; track q) {
              <button mat-stroked-button type="button" (click)="reason = q">{{ q }}</button>
            }
          </div>
        }

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(changed)" [disabled]="busy()">Cerrar</button>
          @if (v.status === 'PENDING') {
            @if (!rejecting()) {
              <button mat-stroked-button color="warn" type="button" (click)="rejecting.set(true)" [disabled]="busy()">
                <mat-icon>block</mat-icon> Rechazar
              </button>
              <button mat-flat-button color="primary" type="button" (click)="approve()" [disabled]="busy()">
                <mat-icon>verified</mat-icon> Aprobar documentos
              </button>
            } @else {
              <button mat-stroked-button type="button" (click)="rejecting.set(false)" [disabled]="busy()">Volver</button>
              <button mat-flat-button color="warn" type="button" (click)="reject()" [disabled]="busy() || reason.trim().length < 5">
                <mat-icon>send</mat-icon> Enviar rechazo
              </button>
            }
          }
          @if (v.status === 'APPROVED') {
            <button mat-stroked-button color="warn" type="button" (click)="revoke()" [disabled]="busy()">
              <mat-icon>remove_moderator</mat-icon> Quitar insignia
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .dialog { padding: 8px 16px; }
      .dialog-header { display: flex; gap: 14px; align-items: flex-start; padding: 4px 0 16px; }
      .header-text { flex: 1; min-width: 0;
        h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .header-icon { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; background: var(--fac-gradient);
        display: flex; align-items: center; justify-content: center; mat-icon { color: #fff; } }
      .status { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
      .st-PENDING { background: rgba(245, 158, 11, 0.14); color: #b45309; }
      .st-APPROVED { background: rgba(11, 99, 246, 0.12); color: #0b63f6; }
      .st-AWAITING_PAYMENT { background: rgba(124, 58, 237, 0.12); color: #7c3aed; }
      .st-REJECTED { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
      .st-CANCELED { background: rgba(100, 116, 139, 0.14); color: #475569; }
      .center { display: grid; place-items: center; padding: 48px 0; }
      .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px;
        div { padding: 10px 12px; border-radius: 12px; background: var(--fac-surface-muted, #f5f7fb); display: flex; flex-direction: column; gap: 2px; }
        span { font-size: 12px; color: var(--fac-text-muted); }
        strong { font-size: 14px; color: var(--fac-text); word-break: break-word; } }
      .approve-box { margin: 4px 0 12px; }
      .date-field { width: 240px; max-width: 100%; }
      .approve-hint { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 12px;
        background: rgba(11, 99, 246, 0.07); color: #1e3a8a; font-size: 13px; line-height: 1.4; }
      .approve-hint mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      .quick-reasons { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 12px; }
      .quick-reasons button { font-size: 12px; line-height: 1.3; height: auto; padding: 6px 10px; white-space: normal; text-align: left; }
      .reason { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; margin-bottom: 14px; border-radius: 12px;
        background: rgba(239, 68, 68, 0.08); color: #b91c1c; font-size: 14px; mat-icon { flex-shrink: 0; } }
      .docs-title { margin: 6px 0 10px; font-size: 15px; font-weight: 600; color: var(--fac-text); }
      .docs { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; margin-bottom: 16px; }
      .doc { display: flex; flex-direction: column; gap: 6px; }
      .doc-view { height: 170px; border-radius: 14px; overflow: hidden; background: #0f172a0d; border: 1px solid #0f172a14;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        img { width: 100%; height: 100%; object-fit: contain; background: #0f172a; }
        .pdf { font-size: 44px; width: 44px; height: 44px; color: #ef4444; }
        .muted { color: var(--fac-text-muted); }
        small { font-size: 12px; color: var(--fac-text-muted); } }
      .doc-view.clickable { cursor: zoom-in; }
      .doc-label { font-size: 13px; font-weight: 600; color: var(--fac-text); }
      .full { width: 100%; }
      .actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; padding-bottom: 8px;
        button { border-radius: 10px; height: 42px; padding: 0 18px; display: inline-flex; align-items: center; gap: 6px; } }
    `,
  ],
})
export class VerificationDetailComponent implements OnInit, OnDestroy {
  private readonly data: { id: number } = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<VerificationDetailComponent, boolean>);
  private readonly service = inject(VerificationService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly item = signal<VerificationItem | null>(null);
  protected readonly docs = signal<DocView[]>([]);
  protected readonly busy = signal(false);
  protected readonly rejecting = signal(false);
  protected reason = '';
  protected readonly quickReasons = [
    'La foto del documento está borrosa o incompleta; súbala de nuevo con buena luz.',
    'La selfie no muestra claramente su rostro junto al documento.',
    'Los datos del documento no coinciden con los de la cuenta.',
    'El documento está vencido o no es válido.',
  ];
  /** Si hubo cambios, la lista se recarga al cerrar. */
  protected changed = false;

  ngOnInit(): void {
    this.service
      .get(this.data.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (v) => {
          this.item.set(v);
          this.loadDocuments(v);
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo cargar la solicitud', 'Cerrar', { duration: 5000 });
          this.dialogRef.close(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.docs().forEach((d) => d.url && URL.revokeObjectURL(d.url));
  }

  private loadDocuments(v: VerificationItem): void {
    this.docs.set(v.documents.map((d) => ({ label: d.label, isPdf: d.mimeType === 'application/pdf', url: null, error: false })));
    v.documents.forEach((d, i) => {
      this.service
        .document(v.id, d.index)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (blob) => this.patchDoc(i, { url: URL.createObjectURL(blob) }),
          error: () => this.patchDoc(i, { error: true }),
        });
    });
  }

  private patchDoc(i: number, patch: Partial<DocView>): void {
    this.docs.update((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  protected open(d: DocView): void {
    if (d.url) window.open(d.url, '_blank', 'noopener');
  }

  protected statusLabel(s: string): string {
    return s === 'AWAITING_PAYMENT' ? 'Aprobada, falta pago' : s === 'PENDING' ? 'En revisión' : s === 'APPROVED' ? 'Verificado'
      : s === 'CANCELED' ? 'Cancelada' : 'Rechazado';
  }

  /** Aprueba: la fecha límite de pago sale de Tabla maestra (Días para pagar una verificación aprobada). */
  protected approve(): void {
    this.run(
      this.service.approve(this.data.id),
      'Aprobada: el usuario tiene el plazo de Tabla maestra para pagar (si es gratis, ya quedó activa)',
    );
  }

  protected reject(): void {
    this.run(this.service.reject(this.data.id, this.reason.trim()), 'Solicitud rechazada; se avisó al usuario');
  }

  protected revoke(): void {
    this.confirmDialog
      .confirm({
        title: 'Quitar insignia',
        message: 'La cuenta o el negocio dejará de mostrarse como verificado.',
        confirmText: 'Quitar',
        cancelText: 'Cancelar',
        icon: 'remove_moderator',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.run(this.service.revoke(this.data.id), 'Insignia retirada', true));
  }

  private run(request$: Observable<unknown>, done: string, closeAfter = false): void {
    this.busy.set(true);
    request$
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.changed = true;
          this.snackBar.open(done, 'Cerrar', { duration: 3500 });
          if (closeAfter || !res) {
            this.dialogRef.close(true);
            return;
          }
          this.item.set(res as VerificationItem);
          this.rejecting.set(false);
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo completar la acción', 'Cerrar', { duration: 5000 }),
      });
  }
}
