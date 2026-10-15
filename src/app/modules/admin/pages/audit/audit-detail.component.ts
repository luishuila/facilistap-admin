import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuditService } from '../../services/audit.service';
import { Audit } from '../../../../core/models/audit.interface';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#22c55e',
  UPDATE: '#1daeff',
  DELETE: '#ef4444',
  LOGIN: '#a855f7',
  LOGOUT: '#94a3b8',
  BLOCK: '#f97316',
  UNBLOCK: '#22c55e',
  PERMISSION_CHANGE: '#eab308',
  ROLE_CHANGE: '#eab308',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio Sesión',
  LOGOUT: 'Cierre Sesión',
  BLOCK: 'Bloqueo',
  UNBLOCK: 'Desbloqueo',
  PERMISSION_CHANGE: 'Cambio Permiso',
  ROLE_CHANGE: 'Cambio Rol',
};

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

@Component({
  selector: 'app-audit-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="audit-detail">
      <div class="dialog-header">
        <h2 class="dialog-title">Detalle de Auditoría</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner [diameter]="40"></mat-spinner>
        </div>
      } @else if (audit()) {
        <div class="detail-content">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">ID</span>
              <span class="detail-value">{{ audit()!.id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Usuario</span>
              <span class="detail-value">{{ audit()!.userName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">ID Usuario</span>
              <span class="detail-value">{{ audit()!.userId }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Acción</span>
              <app-status-badge
                [status]="audit()!.action"
                [colorMap]="actionColorMap"
                [showDot]="true"
              ></app-status-badge>
            </div>
            <div class="detail-item">
              <span class="detail-label">Módulo</span>
              <span class="detail-value">{{ audit()!.module }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Dirección IP</span>
              <span class="detail-value">{{ audit()!.ipAddress || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">User Agent</span>
              <span class="detail-value detail-value-small">{{ audit()!.userAgent || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Fecha</span>
              <span class="detail-value">{{ audit()!.createdAt | date: 'dd/MM/yyyy HH:mm:ss' }}</span>
            </div>
          </div>

          <div class="detail-description">
            <span class="detail-label">Descripción</span>
            <p class="detail-value">{{ audit()!.description }}</p>
          </div>

          @if (audit()!.oldValue || audit()!.newValue) {
            <mat-divider></mat-divider>
            <div class="json-section">
              @if (audit()!.oldValue) {
                <div class="json-block">
                  <h4 class="json-title old-title">
                    <mat-icon>arrow_back</mat-icon>
                    Valor Anterior
                  </h4>
                  <pre class="json-content">{{ audit()!.oldValue | json }}</pre>
                </div>
              }
              @if (audit()!.newValue) {
                <div class="json-block">
                  <h4 class="json-title new-title">
                    <mat-icon>arrow_forward</mat-icon>
                    Valor Nuevo
                  </h4>
                  <pre class="json-content">{{ audit()!.newValue | json }}</pre>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="error-container">
          <p>No se encontró el registro de auditoría</p>
        </div>
      }

      <mat-divider></mat-divider>

      <div class="dialog-footer">
        <button mat-stroked-button (click)="close()">Cerrar</button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .audit-detail {
        padding: 4px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
      }

      .dialog-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
      }

      .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 48px 0;
      }

      .detail-content {
        padding: 8px 0;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .detail-label {
        font-size: 12px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .detail-value {
        font-size: 14px;
        color: #334155;
        font-weight: 500;
        word-break: break-all;
      }

      .detail-value-small {
        font-size: 12px;
        color: #94a3b8;
      }

      .detail-description {
        margin-bottom: 16px;

        p {
          margin: 4px 0 0;
          font-size: 14px;
          color: #475569;
          line-height: 1.6;
        }
      }

      .json-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px 0;
      }

      .json-block {
        h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
      }

      .old-title {
        color: #ef4444;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .new-title {
        color: #22c55e;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .json-content {
        margin: 8px 0 0;
        padding: 12px 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 13px;
        color: #475569;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-all;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      }

      .error-container {
        text-align: center;
        padding: 32px 0;
        color: #94a3b8;
        font-size: 14px;
      }

      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        padding: 16px 0 4px;

        button {
          border-radius: 8px;
          font-weight: 500;
          padding: 0 24px;
        }
      }
    `,
  ],
})
export class AuditDetailComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly dialogRef = inject(MatDialogRef<AuditDetailComponent>);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data: { auditId: number } = inject(MAT_DIALOG_DATA);

  protected readonly audit = signal<Audit | null>(null);
  protected readonly loading = signal(true);

  protected readonly actionColorMap: Record<string, string> = ACTION_COLORS;

  ngOnInit(): void {
    this.loadDetail();
  }

  protected loadDetail(): void {
    this.loading.set(true);

    this.auditService
      .getById(this.data.auditId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.audit.set(res.data ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
