import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { SubscriptionService } from '../../services/subscription.service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import {
  CYCLE_LABELS,
  PAYMENT_STATUS_LABELS,
  SUBSCRIPTION_STATUS_MAP,
  TRANSACTION_STATUS_MAP,
  UserBilling,
} from '../../../../core/models/subscription.interface';
import { SubscriptionGrantComponent, SubscriptionGrantData } from './subscription-grant.component';

export interface SubscriptionDetailData {
  userId: string;
  userName: string;
  userEmail?: string | null;
}

@Component({
  selector: 'app-subscription-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
    LoadingSpinnerComponent,
  ],
  template: `
    <div class="detail-dialog">
      <div class="dialog-header">
        <div>
          <h2 class="dialog-title">{{ data.userName }}</h2>
          <p class="dialog-subtitle">{{ data.userEmail }}</p>
        </div>
        <button mat-icon-button (click)="close()"><mat-icon>close</mat-icon></button>
      </div>

      @if (loading()) {
        <app-loading-spinner [diameter]="40" message="Cargando..." />
      } @else if (billing()) {
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Estado de pago</span>
            <span class="info-value">{{ paymentLabels[billing()!.paymentStatus] }}</span>
          </div>
          @if (billing()!.subscription; as sub) {
            <div class="info-row">
              <span class="info-label">Suscripción</span>
              <span class="badge" [style.background]="statusMap[sub.status].color">{{ statusMap[sub.status].label }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Ciclo</span>
              <span class="info-value">{{ cycleLabels[sub.billingCycle] }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Inicio</span>
              <span class="info-value">{{ sub.startAt | date: 'dd/MM/yyyy' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Vence</span>
              <span class="info-value">{{ sub.endAt | date: 'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Último valor</span>
              <span class="info-value">{{ sub.amount | currency: sub.currency : 'symbol' : '1.0-0' }}</span>
            </div>
          } @else {
            <p class="muted">Este usuario no tiene suscripciones.</p>
          }
        </div>

        <mat-divider />

        <h4 class="section-title">Pagos ({{ billing()!.transactions.length }})</h4>
        @if (billing()!.transactions.length === 0) {
          <p class="muted">Sin pagos registrados.</p>
        } @else {
          <div class="tx-list">
            @for (tx of billing()!.transactions; track tx.id) {
              <div class="tx-item">
                <div class="tx-main">
                  <span class="tx-ref">{{ tx.reference }}</span>
                  <span class="muted">{{ tx.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ cycleLabels[tx.billingCycle] }} · {{ tx.gateway || '—' }}</span>
                </div>
                <span class="tx-amount">{{ tx.amount | currency: tx.currency : 'symbol' : '1.0-0' }}</span>
                <span class="badge" [style.background]="txStatusMap[tx.status].color">{{ txStatusMap[tx.status].label }}</span>
              </div>
            }
          </div>
        }

        <div class="dialog-actions">
          @if (billing()!.subscription?.status === 'ACTIVE') {
            <button mat-stroked-button color="warn" (click)="cancelSubscription()" [disabled]="working()">
              <mat-icon>block</mat-icon>
              <span>Cancelar suscripción</span>
            </button>
          }
          <button mat-flat-button color="primary" (click)="extend()" [disabled]="working()">
            <mat-icon>add_circle</mat-icon>
            <span>{{ billing()!.subscription ? 'Agregar días' : 'Activar' }}</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .detail-dialog { padding: 8px 16px 16px; }
      .dialog-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0 16px; }
      .dialog-title { margin: 0; font-size: 20px; font-weight: 600; color: #1e293b; }
      .dialog-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748b; }
      .info-grid { display: flex; flex-direction: column; gap: 10px; padding-bottom: 16px; }
      .info-row { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; }
      .info-label { color: #64748b; }
      .info-value { color: #1e293b; font-weight: 500; text-align: right; }
      .badge { color: #fff; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 12px; white-space: nowrap; }
      .section-title { margin: 16px 0 8px; font-size: 15px; color: #1e293b; }
      .muted { color: #94a3b8; font-size: 13px; margin: 0; }
      .tx-list { display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; }
      .tx-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 8px; background: #f8fafc; }
      .tx-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .tx-ref { font-family: 'Consolas', monospace; font-size: 12px; color: #1e293b; overflow: hidden; text-overflow: ellipsis; }
      .tx-amount { font-weight: 600; color: #1e293b; white-space: nowrap; }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding-top: 20px; flex-wrap: wrap;
        button { border-radius: 8px; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; }
      }
    `,
  ],
})
export class SubscriptionDetailComponent implements OnInit {
  protected readonly data: SubscriptionDetailData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SubscriptionDetailComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly billing = signal<UserBilling | null>(null);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  private changed = false;

  protected readonly statusMap = SUBSCRIPTION_STATUS_MAP;
  protected readonly txStatusMap = TRANSACTION_STATUS_MAP;
  protected readonly cycleLabels = CYCLE_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.subscriptionService
      .getUserBilling(this.data.userId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.billing.set(res.data ?? null),
        error: () => {
          this.snackBar.open('Error al cargar la suscripción', 'Cerrar', { duration: 5000 });
          this.close();
        },
      });
  }

  protected extend(): void {
    this.dialog
      .open<SubscriptionGrantComponent, SubscriptionGrantData, boolean>(SubscriptionGrantComponent, {
        width: '540px',
        autoFocus: false,
        data: {
          user: { id: this.data.userId, name: this.data.userName, email: this.data.userEmail },
          endAt: this.billing()?.subscription?.endAt ?? null,
          status: this.billing()?.subscription?.status ?? null,
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) {
          this.changed = true;
          this.load();
        }
      });
  }

  protected cancelSubscription(): void {
    const sub = this.billing()?.subscription;
    if (!sub) return;
    this.confirmDialog
      .confirm({
        title: 'Cancelar suscripción',
        message: `La suscripción de ${this.data.userName} termina ahora y sus empleados quedan inactivos (salvo los que tengan citas pendientes). ¿Continuar?`,
        confirmText: 'Cancelar suscripción',
        cancelText: 'Volver',
        icon: 'block',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.working.set(true);
        this.subscriptionService
          .cancel(sub.id)
          .pipe(
            finalize(() => this.working.set(false)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe({
            next: () => {
              this.changed = true;
              this.snackBar.open('Suscripción cancelada', 'Cerrar', { duration: 3000 });
              this.load();
            },
            error: () => this.snackBar.open('No se pudo cancelar la suscripción', 'Cerrar', { duration: 5000 }),
          });
      });
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }
}
