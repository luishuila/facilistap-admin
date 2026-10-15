import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize, interval } from 'rxjs';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { PqrsService } from '../../services/pqrs.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  Complaint,
  ComplaintAdmin,
  ComplaintNote,
  ComplaintStatus,
} from '../../../../core/models/complaint.interface';

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  pending: '#f59e0b',
  in_progress: '#1daeff',
  resolved: '#10b981',
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
};

const TYPE_COLORS: Record<string, string> = {
  petition: '#0b63f6',
  complaint: '#ef4444',
  claim: '#f59e0b',
  suggestion: '#10b981',
  report: '#8b5cf6',
};

const TYPE_LABELS: Record<string, string> = {
  petition: 'Petición',
  complaint: 'Queja',
  claim: 'Reclamo',
  suggestion: 'Sugerencia',
  report: 'Denuncia',
};

@Component({
  selector: 'app-pqrs-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pqrs-detail">
      <div class="dialog-header">
        <h2 class="dialog-title">PQRS #{{ pqrs()?.id }}</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <app-loading-spinner [diameter]="40" [message]="'Cargando...'" />
      } @else if (pqrs(); as p) {
        <mat-tab-group dynamicHeight animationDuration="200ms" [(selectedIndex)]="tabIndex">
          <mat-tab label="Información">
            <div class="tab-content">
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Tipo</span>
                  <app-status-badge [status]="p.type" [colorMap]="typeColors" [labelMap]="typeLabels" />
                </div>
                <div class="info-row">
                  <span class="info-label">Estado</span>
                  <app-status-badge [status]="p.status" [colorMap]="statusColors" [labelMap]="statusLabels" />
                </div>
                <div class="info-row">
                  <span class="info-label">Motivo</span>
                  <span class="info-value">{{ p.reasonLabel || p.reason }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Usuario</span>
                  <span class="info-value">{{ p.userName || '—' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Responsable</span>
                  <span class="info-value">
                    @if (p.assignedTo) {
                      {{ adminName(p.assignedTo) }}
                      <small class="muted">· desde {{ p.assignedAt | date: 'dd/MM/yyyy HH:mm' }}</small>
                    } @else {
                      <span class="muted">Sin tomar</span>
                    }
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">Fecha creación</span>
                  <span class="info-value">{{ p.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                </div>
              </div>

              <mat-divider class="section-divider" />

              <h4 class="section-title">Descripción</h4>
              <p class="description-text">{{ p.description }}</p>

              @if (images().length) {
                <h4 class="section-title">Imágenes del usuario ({{ images().length }})</h4>
                <div class="image-grid">
                  @for (img of images(); track img) {
                    <a class="image-thumb" [href]="img" target="_blank" rel="noopener" title="Abrir imagen">
                      <img [src]="img" alt="Imagen adjunta" loading="lazy" />
                    </a>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <mat-tab [label]="'Conversación (' + responses().length + ')'">
            <div class="tab-content">
              <div class="refresh-row">
                <span class="muted">Se actualiza sola cada 10 s</span>
                <button mat-button type="button" (click)="refresh()" [disabled]="refreshing()">
                  <mat-icon>refresh</mat-icon>
                  Actualizar
                </button>
              </div>
              <div class="timeline">
                <!-- La solicitud original abre la conversacion, con sus imagenes. -->
                <div class="msg msg-user">
                  <div class="msg-header">
                    <mat-icon>person</mat-icon>
                    <span class="msg-author">{{ p.userName || 'Usuario' }} · solicitud</span>
                    <span class="msg-date">{{ p.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                  <p class="msg-text"><b>{{ p.reasonLabel || p.reason }}</b></p>
                  @if (p.description) {
                    <p class="msg-text">{{ p.description }}</p>
                  }
                  @if (images().length) {
                    <div class="msg-images">
                      @for (img of images(); track img) {
                        <a class="image-thumb" [href]="img" target="_blank" rel="noopener" title="Abrir imagen">
                          <img [src]="img" alt="Imagen adjunta" loading="lazy" />
                        </a>
                      }
                    </div>
                  }
                </div>
                @if (responses().length === 0) {
                  <p class="muted empty-note">Aún no hay respuestas.</p>
                }
                  @for (n of responses(); track n.id) {
                    <div class="msg" [class.msg-user]="n.authorRole === 'user'" [class.msg-system]="n.authorRole === 'system'">
                      <div class="msg-header">
                        <mat-icon>{{ n.authorRole === 'user' ? 'person' : n.authorRole === 'system' ? 'info' : 'verified_user' }}</mat-icon>
                        <span class="msg-author">{{ n.authorRole === 'system' ? 'Sistema' : n.authorName || (n.authorRole === 'user' ? 'Usuario' : 'Administrador') }}</span>
                        <span class="msg-date">{{ n.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                      </div>
                      <p class="msg-text">{{ n.note }}</p>
                    </div>
                  }
                <div #conversationEnd></div>
              </div>
            </div>
          </mat-tab>

          <mat-tab [label]="'Imágenes (' + images().length + ')'">
            <div class="tab-content">
              @if (images().length === 0) {
                <div class="empty-section">
                  <mat-icon>image_not_supported</mat-icon>
                  <p>El usuario no adjuntó imágenes</p>
                </div>
              } @else {
                <div class="image-grid large">
                  @for (img of images(); track img) {
                    <a class="image-thumb" [href]="img" target="_blank" rel="noopener" title="Abrir imagen">
                      <img [src]="img" alt="Imagen adjunta" loading="lazy" />
                    </a>
                  }
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>

        <mat-divider class="action-divider" />

        @switch (p.status) {
          @case ('pending') {
            <!-- Paso 1: alguien toma la PQRS (queda En proceso y se avisa al usuario). -->
            <div class="step-box">
              <div class="step-text">
                <mat-icon>assignment_ind</mat-icon>
                <div>
                  <strong>Tomar la solicitud</strong>
                  <span>Elija quién la atenderá. Pasa a <b>En proceso</b> y el usuario recibe un aviso de que su solicitud fue tomada.</span>
                </div>
              </div>
              <div class="step-actions">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="assignee-field">
                  <mat-label>Responsable</mat-label>
                  <mat-select [formControl]="assigneeControl">
                    @for (a of admins(); track a.id) {
                      <mat-option [value]="a.id">{{ a.name }}{{ a.id === currentUserId ? ' (yo)' : '' }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-flat-button color="primary" type="button" [disabled]="submitting() || !assigneeControl.value" (click)="take()">
                  @if (submitting()) {
                    <mat-spinner diameter="18"></mat-spinner>
                  } @else {
                    <mat-icon>play_arrow</mat-icon>
                  }
                  Tomar y poner En proceso
                </button>
              </div>
            </div>
          }

          @case ('in_progress') {
            <!-- Paso 2: responder; el usuario recibe un aviso con cada respuesta. -->
            <div class="management-section">
              <h4 class="section-title" #replySection>
                Responder
                @if (p.assignedTo) {
                  <small class="muted">· responsable: {{ adminName(p.assignedTo) }}</small>
                }
              </h4>
              <form [formGroup]="responseForm" class="management-form">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Respuesta para el usuario</mat-label>
                  <textarea #replyInput matInput formControlName="response" rows="4" placeholder="Escriba la respuesta..."></textarea>
                  @if (submitAttempted() && responseForm.get('response')?.hasError('required')) {
                    <mat-error>Escriba la respuesta</mat-error>
                  }
                </mat-form-field>

                <div class="management-actions-row">
                  <mat-form-field appearance="outline" class="action-field" subscriptSizing="dynamic">
                    <mat-label>Después de enviar</mat-label>
                    <mat-select formControlName="status">
                      <mat-option value="in_progress">Dejar en proceso</mat-option>
                      <mat-option value="resolved">Marcar como resuelta</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <button mat-flat-button color="primary" type="button" [disabled]="submitting()" (click)="onSubmitReply()">
                    @if (submitting()) {
                      <mat-spinner diameter="18"></mat-spinner>
                    } @else {
                      <mat-icon>send</mat-icon>
                    }
                    Enviar respuesta
                  </button>
                </div>
              </form>
            </div>
          }

          @default {
            <div class="resolved-box">
              <mat-icon>check_circle</mat-icon>
              <span>Esta PQRS está resuelta. Para enviar otra respuesta, reábrala.</span>
              <button mat-stroked-button color="primary" type="button" [disabled]="submitting()" (click)="reopen()">
                <mat-icon>replay</mat-icon>
                Reabrir para responder
              </button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .pqrs-detail { max-height: 85vh; overflow-y: auto; padding: 8px; }
      .dialog-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .dialog-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
      .tab-content { padding: 16px 4px; }
      .info-grid { display: flex; flex-direction: column; gap: 12px; }
      .info-row { display: flex; align-items: center; gap: 16px; }
      .info-label { width: 130px; flex-shrink: 0; font-size: 13px; font-weight: 600; color: #64748b; }
      .info-value { font-size: 14px; color: var(--fac-text); }
      .muted { color: #94a3b8; font-weight: 400; }
      .section-divider, .action-divider { margin: 16px 0; }
      .section-title { margin: 12px 0 8px; font-size: 15px; font-weight: 600; color: var(--fac-text); }
      .description-text { margin: 0; font-size: 14px; color: #475569; white-space: pre-wrap; }

      .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
      .image-grid.large { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
      .image-thumb {
        display: block; aspect-ratio: 1; border-radius: 10px; overflow: hidden;
        border: 1px solid var(--fac-border); background: #f8fafc;
        img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s; }
        &:hover img { transform: scale(1.04); }
      }

      .refresh-row {
        display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 8px;
        font-size: 12px;
        button { height: 32px; }
      }
      .msg-images { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; margin-top: 8px; }
      .empty-note { text-align: center; font-size: 13px; margin: 4px 0; }
      .empty-section { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 0; color: #94a3b8; }
      .timeline { display: flex; flex-direction: column; gap: 10px; }
      .msg { padding: 10px 14px; border-radius: 12px; background: var(--fac-primary-soft); max-width: 92%; }
      .msg-user { background: #f1f5f9; align-self: flex-start; }
      .msg:not(.msg-user) { align-self: flex-end; }
      .msg-system { align-self: center; background: #fff7ed; max-width: 100%; }
      .msg-header {
        display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--fac-primary-shade); }
      }
      .msg-author { font-size: 13px; font-weight: 600; color: var(--fac-text); }
      .msg-date { margin-left: auto; font-size: 11px; color: #94a3b8; }
      .msg-text { margin: 0; font-size: 14px; color: #334155; white-space: pre-wrap; }

      .step-box {
        display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 12px;
        background: var(--fac-primary-soft);
      }
      .step-text {
        display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: #33556b;
        mat-icon { color: var(--fac-primary-shade); }
        div { display: flex; flex-direction: column; gap: 2px; }
        strong { font-size: 14px; color: var(--fac-text); }
      }
      .step-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .assignee-field { flex: 1; min-width: 220px; }

      .management-form { display: flex; flex-direction: column; gap: 4px; }
      .full-width { width: 100%; }
      .management-actions-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .action-field { min-width: 220px; }
      button[mat-flat-button], button[mat-stroked-button] {
        border-radius: 10px; height: 44px; display: inline-flex; align-items: center; gap: 6px;
      }

      .resolved-box {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; border-radius: 10px;
        background: #ecfdf5; color: #065f46; font-size: 14px;
        mat-icon { color: #10b981; }
        span { flex: 1; min-width: 200px; }
      }
    `,
  ],
})
export class PqrsDetailComponent implements OnInit {
  private readonly pqrsService = inject(PqrsService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<PqrsDetailComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly data: { pqrsId: number; focusReply?: boolean } = inject(MAT_DIALOG_DATA);
  @ViewChild('replyInput') private replyInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('replySection') private replySection?: ElementRef<HTMLElement>;

  protected readonly pqrs = signal<Complaint | null>(null);
  protected readonly responses = signal<ComplaintNote[]>([]);
  protected readonly admins = signal<ComplaintAdmin[]>([]);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly submitAttempted = signal(false);
  protected tabIndex = 0;
  @ViewChild('conversationEnd') private conversationEnd?: ElementRef<HTMLElement>;
  /** Cada 10 s se traen los mensajes nuevos del usuario mientras el dialogo esta abierto. */
  private static readonly REFRESH_MS = 10_000;
  private changed = false;

  protected readonly statusColors = STATUS_COLORS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly typeColors = TYPE_COLORS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly currentUserId = this.authService.getCurrentUser()?.id ?? null;

  /** URLs listas para <img>: S3 tal cual, rutas locales con el host del backend. */
  protected readonly images = computed(() => (this.pqrs()?.images ?? []).map((i) => this.pqrsService.imageUrl(i)));

  protected readonly assigneeControl = new FormControl<string | null>(this.currentUserId);
  protected responseForm = this.fb.group({
    response: ['', [Validators.required]],
    status: ['in_progress' as ComplaintStatus],
  });

  ngOnInit(): void {
    this.loadPqrs();
    interval(PqrsDetailComponent.REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.submitting() && !this.loading()) this.refresh(true);
      });
    this.pqrsService
      .getAdmins()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (admins) => {
          this.admins.set(admins);
          if (!admins.some((a) => a.id === this.assigneeControl.value)) {
            this.assigneeControl.setValue(admins[0]?.id ?? null);
          }
        },
      });
  }

  protected adminName(u: { name?: string; lastname?: string; email?: string } | null | undefined): string {
    return [u?.name, u?.lastname].filter(Boolean).join(' ') || u?.email || 'Administrador';
  }

  private loadPqrs(): void {
    this.loading.set(true);
    this.pqrsService
      .getById(this.data.pqrsId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const item = res.data;
          if (!item) return;
          this.pqrs.set(item);
          // Conversacion en orden cronologico (la mas reciente al final, como un chat).
          this.responses.set([...item.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
          this.responseForm.reset({ response: '', status: 'in_progress' });
          if (this.data.focusReply && item.status === 'in_progress') {
            this.data.focusReply = false;
            setTimeout(() => {
              this.replySection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              this.replyInput?.nativeElement.focus();
            }, 150);
          }
        },
        error: () => {
          this.snackBar.open('Error al cargar el PQRS', 'Cerrar', { duration: 5000 });
          this.dialogRef.close(false);
        },
      });
  }

  /** Trae la PQRS sin spinner; avisa si el usuario escribio algo nuevo. */
  protected refresh(silent = false): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    const before = this.responses().length;
    this.pqrsService
      .getById(this.data.pqrsId)
      .pipe(
        finalize(() => this.refreshing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const item = res.data;
          if (!item) return;
          this.pqrs.set(item);
          const notes = [...item.notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          this.responses.set(notes);
          const fresh = notes.slice(before).filter((n) => n.authorRole === 'user');
          if (fresh.length) {
            this.snackBar.open(`Nuevo mensaje del usuario: "${fresh[fresh.length - 1].note.slice(0, 60)}"`, 'Ver', { duration: 6000 })
              .onAction()
              .subscribe(() => {
                this.tabIndex = 1;
                this.cdr.markForCheck();
              });
            this.scrollConversationToEnd();
          }
        },
        error: () => {
          if (!silent) this.snackBar.open('No se pudo actualizar la conversación', 'Cerrar', { duration: 4000 });
        },
      });
  }

  private scrollConversationToEnd(): void {
    setTimeout(() => this.conversationEnd?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
  }

  protected take(): void {
    const assigneeId = this.assigneeControl.value;
    if (!assigneeId) return;
    this.submitting.set(true);
    this.pqrsService
      .take(this.data.pqrsId, assigneeId)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.changed = true;
          this.snackBar.open('Solicitud tomada: el usuario fue notificado', 'Cerrar', { duration: 3000 });
          this.data.focusReply = true;
          this.loadPqrs();
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo tomar la solicitud', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onSubmitReply(): void {
    const control = this.responseForm.get('response');
    this.submitAttempted.set(true);
    if (control?.invalid || !String(control?.value ?? '').trim()) {
      control?.setErrors({ required: true });
      return;
    }
    const text = String(control?.value ?? '').trim();
    const newStatus = this.responseForm.value.status as ComplaintStatus;
    this.submitting.set(true);

    this.pqrsService
      .respond(this.data.pqrsId, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.changed = true;
          if (newStatus === 'resolved') {
            this.pqrsService
              .changeStatus(this.data.pqrsId, 'resolved')
              .pipe(
                finalize(() => this.submitting.set(false)),
                takeUntilDestroyed(this.destroyRef),
              )
              .subscribe({
                next: () => this.afterSave('Respuesta enviada y solicitud resuelta'),
                error: () => {
                  this.snackBar.open('Respuesta enviada, pero no se pudo marcar como resuelta', 'Cerrar', { duration: 5000 });
                  this.loadPqrs();
                },
              });
          } else {
            this.submitting.set(false);
            this.afterSave('Respuesta enviada: el usuario fue notificado');
          }
        },
        error: (err: Error) => {
          this.submitting.set(false);
          this.snackBar.open(err?.message || 'Error al enviar la respuesta', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private afterSave(msg: string): void {
    this.snackBar.open(msg, 'Cerrar', { duration: 3000 });
    this.submitAttempted.set(false);
    this.tabIndex = 1;
    this.loadPqrs();
    this.scrollConversationToEnd();
  }

  /** Resuelta -> En proceso, para poder responder de nuevo. */
  protected reopen(): void {
    this.submitting.set(true);
    this.pqrsService
      .changeStatus(this.data.pqrsId, 'in_progress')
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.changed = true;
          this.data.focusReply = true;
          this.loadPqrs();
        },
        error: () => this.snackBar.open('No se pudo reabrir la PQRS', 'Cerrar', { duration: 5000 }),
      });
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
