import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProviderWithdrawalItem, WithdrawalKind } from '../../services/store.service';
import { formatMoney } from '../../../../core/utils/money.util';

export interface WithdrawalDialogData {
  mode: 'pay' | 'reject';
  item: ProviderWithdrawalItem;
  /** Sin él, de un negocio. */
  kind?: WithdrawalKind;
}

/**
 * Pagar o rechazar un retiro de la billetera de un negocio. Muestra a dónde transferir (cuenta,
 * Nequi o Daviplata y titular). Pagar: comprobante opcional. Rechazar: motivo obligatorio.
 * Devuelve { reference } o { note }; nada si vuelve atrás.
 */
@Component({
  selector: 'app-withdrawal-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="box">
      <div class="head">
        <span class="icon" [class.warn]="data.mode === 'reject'"><mat-icon>{{ data.mode === 'pay' ? 'payments' : 'block' }}</mat-icon></span>
        <div>
          <h2>{{ data.mode === 'pay' ? 'Marcar retiro como pagado' : 'Rechazar retiro' }}</h2>
          <p>{{ data.item.providerName }} · solicitado por {{ data.item.requestedByName || '—' }}</p>
        </div>
      </div>

      <div class="amount">{{ money(data.item.amount) }}</div>

      <div class="account">
        <div><span>Medio</span><strong>{{ methodLabel }}</strong></div>
        <div><span>Titular</span><strong>{{ data.item.account.holderName }}</strong></div>
        <div><span>Documento</span><strong>{{ data.item.account.documentTypeName || data.item.account.documentType }} {{ data.item.account.documentNumber }}</strong></div>
        @if (data.item.method === 'BANK_ACCOUNT') {
          <div><span>Banco</span><strong>{{ data.item.account.bankName }}</strong></div>
          <div><span>Cuenta</span><strong>{{ data.item.account.accountTypeName || data.item.account.accountType }} · {{ data.item.account.accountNumber }}</strong></div>
        } @else {
          <div><span>Celular</span><strong>{{ data.item.account.phone }}</strong></div>
        }
      </div>

      @if (data.mode === 'pay') {
        <mat-form-field appearance="outline" class="full">
          <mat-label>Comprobante o referencia de la transferencia (opcional)</mat-label>
          <input matInput [(ngModel)]="text" maxlength="120" />
          <mat-hint>{{ isUser ? 'Al marcarlo pagado se le avisa al usuario.' : 'Al marcarlo pagado, sus agendas quedan liquidadas y se le avisa al negocio.' }}</mat-hint>
        </mat-form-field>
      } @else {
        <mat-form-field appearance="outline" class="full">
          <mat-label>Motivo del rechazo (lo verá {{ isUser ? 'el usuario' : 'el negocio' }})</mat-label>
          <textarea matInput rows="3" [(ngModel)]="text" maxlength="300" placeholder="Ej: El número de cuenta no coincide con el titular."></textarea>
          <mat-hint>Obligatorio (mínimo 5 caracteres). {{ isUser ? 'Las monedas vuelven a su billetera' : 'El saldo vuelve a quedar disponible' }} para pedirlo de nuevo.</mat-hint>
        </mat-form-field>
      }

      <div class="actions">
        <button mat-stroked-button type="button" (click)="ref.close()">Volver</button>
        @if (data.mode === 'pay') {
          <button mat-flat-button color="primary" type="button" (click)="ref.close({ reference: text.trim() })">
            <mat-icon>check</mat-icon> Marcar pagado
          </button>
        } @else {
          <button mat-flat-button color="warn" type="button" [disabled]="text.trim().length < 5" (click)="ref.close({ note: text.trim() })">
            <mat-icon>block</mat-icon> Rechazar
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .box { padding: 20px 22px 12px; max-width: 480px; }
      .head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px;
        h2 { margin: 0; font-size: 18px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .icon { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: grid; place-items: center;
        background: #16a34a; mat-icon { color: #fff; } }
      .icon.warn { background: #ef4444; }
      .amount { font-size: 28px; font-weight: 800; color: #15803d; margin: 4px 0 12px; }
      .account { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;
        div { padding: 8px 10px; border-radius: 10px; background: var(--fac-bg, #f6f7fb); display: flex; flex-direction: column; gap: 2px; }
        span { font-size: 11px; color: var(--fac-text-muted); }
        strong { font-size: 13px; color: var(--fac-text); word-break: break-word; } }
      .full { width: 100%; }
      .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;
        button { border-radius: 10px; height: 40px; padding: 0 16px; display: inline-flex; align-items: center; gap: 6px; } }
    `,
  ],
})
export class WithdrawalDialogComponent {
  protected readonly data: WithdrawalDialogData = inject(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<WithdrawalDialogComponent, { reference?: string; note?: string }>);
  protected text = '';

  protected get isUser(): boolean {
    return this.data.kind === 'user';
  }

  protected get methodLabel(): string {
    return this.data.item.method === 'BANK_ACCOUNT' ? 'Cuenta bancaria' : this.data.item.method === 'NEQUI' ? 'Nequi' : 'Daviplata';
  }

  protected money(v: number): string {
    return formatMoney(v, this.data.item.currency);
  }
}
