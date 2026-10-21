import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, finalize } from 'rxjs';

import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { GatewayCommission, PackageDiscountType, StoreAdminService, WalletConfig, WalletPackage } from '../../services/store.service';

/** Tipo de descuento en el formulario: NONE = sin descuento. */
type DiscountKind = PackageDiscountType | 'NONE';

/** Lo editable de un paquete (o del paquete nuevo). */
interface PackageForm {
  value: number | null;
  kind: DiscountKind;
  discount: number | null;
}

/** Fila de un paquete con su formulario (los cambios se guardan con "Guardar"). */
type PackageDraft = WalletPackage & { form: PackageForm };

/**
 * Billetera de la app (Tienda → Billetera): paquetes de recarga (cuánto recibe y cuánto
 * paga el usuario) y el mínimo/máximo de la recarga libre ("Otro valor").
 */
@Component({
  selector: 'app-wallet-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <h1 class="page-title">Billetera</h1>
        <p class="page-subtitle">
          Lo que ven los usuarios en la Tienda → Billetera: los paquetes de recarga y el rango de la recarga libre ("Otro valor").
          Los valores van en múltiplos de {{ money(coinValue()) }}.
        </p>
      </div>

      @if (loading()) {
        <p class="muted">Cargando…</p>
      } @else {
        <!-- Recarga libre -->
        <section class="panel">
          <div class="panel-head">
            <mat-icon>edit_note</mat-icon>
            <div>
              <h2>Recarga libre ("Otro valor")</h2>
              <p>El usuario escribe cuánto recargar, entre estos dos valores. Paga exactamente lo que recarga.</p>
            </div>
          </div>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Mínimo</mat-label>
              <span matTextPrefix>$&nbsp;</span>
              <input matInput type="number" min="0" [step]="coinValue()" [(ngModel)]="min" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Máximo</mat-label>
              <span matTextPrefix>$&nbsp;</span>
              <input matInput type="number" min="0" [step]="coinValue()" [(ngModel)]="max" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="saveTopUp()" [disabled]="busy()">
              <mat-icon>save</mat-icon> Guardar rango
            </button>
          </div>
          <small class="muted">Ahora: de {{ money(config()?.topUp?.min ?? 0) }} a {{ money(config()?.topUp?.max ?? 0) }}.</small>
        </section>

        <!-- Comisión por pasarela de pago -->
        <section class="panel">
          <div class="panel-head">
            <mat-icon>percent</mat-icon>
            <div>
              <h2>Comisión por pasarela de pago</h2>
              <p>Lo que se le suma al cliente cuando paga con esa pasarela (carrito y agendas): se ve como "Comisión" antes de pagar. Apagada, no se cobra. Es aparte de la comisión de FacilisTap al negocio. Los medios que acepta cada negocio los activa el negocio.</p>
            </div>
          </div>
          @for (g of gateways; track g.key) {
            <div class="row commission-row">
              <mat-slide-toggle [(ngModel)]="commissionForm[g.key].enabled" [disabled]="busy()">
                <strong>{{ g.label }}</strong>
              </mat-slide-toggle>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Comisión</mat-label>
                <input matInput type="number" min="0" max="100" step="0.5" [(ngModel)]="commissionForm[g.key].percent"
                  [disabled]="busy() || !commissionForm[g.key].enabled" />
                <span matTextSuffix>&nbsp;%</span>
              </mat-form-field>
              <small class="muted">
                Ahora: {{ config()?.commissions?.[g.key]?.enabled ? (config()?.commissions?.[g.key]?.percent + '%') : 'no se cobra' }}
              </small>
            </div>
          }
          <div class="row">
            <button mat-flat-button color="primary" (click)="saveCommissions()" [disabled]="busy()">
              <mat-icon>save</mat-icon> Guardar comisiones
            </button>
          </div>
        </section>

        <!-- Retiro de la billetera del usuario -->
        <section class="panel">
          <div class="panel-head">
            <mat-icon>account_balance</mat-icon>
            <div>
              <h2>Retiro de la billetera del usuario</h2>
              <p>El usuario puede pedir el retiro del monto que elija de su saldo. Este es el mínimo por retiro; 0 = sin mínimo.</p>
            </div>
          </div>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Mínimo para retirar</mat-label>
              <span matTextPrefix>$&nbsp;</span>
              <input matInput type="number" min="0" [step]="coinValue()" [(ngModel)]="withdrawMin" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="saveWithdrawMin()" [disabled]="busy()">
              <mat-icon>save</mat-icon> Guardar mínimo
            </button>
          </div>
          <small class="muted">Ahora: {{ money(config()?.userWithdrawMin ?? 0) }}.</small>
        </section>

        <!-- Espera para retirar (billetera del negocio) -->
        <section class="panel">
          <div class="panel-head">
            <mat-icon>hourglass_top</mat-icon>
            <div>
              <h2>Espera para retirar (billetera del negocio)</h2>
              <p>Minutos desde que se finaliza la cita hasta que su pago pasa a "Disponible" para retirar (p. ej. 5). 0 = apenas se finaliza. Un pago con una solicitud de reembolso pendiente no se puede retirar hasta que el dueño decida.</p>
            </div>
          </div>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Minutos de espera</mat-label>
              <input matInput type="number" min="0" max="43200" step="1" [(ngModel)]="holdMinutes" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="saveHoldMinutes()" [disabled]="busy()">
              <mat-icon>save</mat-icon> Guardar minutos
            </button>
          </div>
          <small class="muted">Ahora: {{ (config()?.withdrawHoldMinutes ?? 0) === 0 ? 'apenas se finaliza la cita' : (config()?.withdrawHoldMinutes + ' minutos después de finalizar') }}.</small>
        </section>

        <!-- Reembolso de citas finalizadas (lo hace el negocio) -->
        <section class="panel">
          <div class="panel-head">
            <mat-icon>undo</mat-icon>
            <div>
              <h2>Reembolso de citas finalizadas</h2>
              <p>El empleado, el asistente o el dueño pueden pedir el reembolso (total o parcial, con motivo) de una cita pagada en la app y ya finalizada, hasta estos días después de la cita; el dueño lo aprueba en la app. 0 = no se puede.</p>
            </div>
          </div>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Días para reembolsar</mat-label>
              <input matInput type="number" min="0" max="365" step="1" [(ngModel)]="refundDays" />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="saveRefundDays()" [disabled]="busy()">
              <mat-icon>save</mat-icon> Guardar días
            </button>
          </div>
          <small class="muted">Ahora: {{ config()?.refundWindowDays ?? 7 }} días después de la cita.</small>
        </section>

        <!-- Paquetes -->
        <section class="panel">
          <div class="panel-head">
            <mat-icon>savings</mat-icon>
            <div>
              <h2>Paquetes de recarga</h2>
              <p>Ponga cuánto recibe el usuario y, si quiere, un descuento en % o en valor fijo: la app le muestra lo que paga y cuánto ahorra. Los desactivados no se ven en la app.</p>
            </div>
          </div>

          <div class="packages">
            @for (p of packages(); track p.id) {
              <div class="pkg" [class.off]="!p.isActive">
                <ng-container *ngTemplateOutlet="packageFields; context: { $implicit: p.form }"></ng-container>
                <mat-slide-toggle [checked]="p.isActive" (change)="toggle(p, $event.checked)" [disabled]="busy()">
                  {{ p.isActive ? 'Activo' : 'Inactivo' }}
                </mat-slide-toggle>
                <div class="pkg-actions">
                  <button mat-icon-button color="primary" matTooltip="Guardar" (click)="savePackage(p)"
                    [disabled]="busy() || !changed(p) || !!formError(p.form)">
                    <mat-icon>save</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" matTooltip="Eliminar" (click)="remove(p)" [disabled]="busy()">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            } @empty {
              <p class="muted">No hay paquetes. Agregue el primero abajo.</p>
            }
          </div>

          <div class="new-pkg">
            <strong>Nuevo paquete</strong>
            <div class="pkg new">
              <ng-container *ngTemplateOutlet="packageFields; context: { $implicit: newForm }"></ng-container>
              <button mat-flat-button color="primary" class="add-btn" (click)="addPackage()" [disabled]="busy() || !!formError(newForm)">
                <mat-icon>add</mat-icon> Agregar paquete
              </button>
            </div>
          </div>
        </section>
      }

      <!-- Campos de un paquete: recibe, descuento (% o $) y lo que paga (calculado) -->
      <ng-template #packageFields let-f>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Recibe</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" min="0" [step]="coinValue()" [(ngModel)]="f.value" placeholder="50000" />
        </mat-form-field>
        <mat-button-toggle-group [(ngModel)]="f.kind" hideSingleSelectionIndicator aria-label="Tipo de descuento">
          <mat-button-toggle value="NONE">Sin descuento</mat-button-toggle>
          <mat-button-toggle value="PERCENT">%</mat-button-toggle>
          <mat-button-toggle value="AMOUNT">$</mat-button-toggle>
        </mat-button-toggle-group>
        @if (f.kind !== 'NONE') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="discount">
            <mat-label>Descuento</mat-label>
            @if (f.kind === 'AMOUNT') { <span matTextPrefix>$&nbsp;</span> }
            <input matInput type="number" min="0" [(ngModel)]="f.discount" />
            @if (f.kind === 'PERCENT') { <span matTextSuffix>%</span> }
          </mat-form-field>
        }
        <div class="pays">
          <small>Paga</small>
          <strong>{{ money(priceOf(f)) }}</strong>
          @if (formError(f); as err) {
            <span class="err">{{ err }}</span>
          } @else if (discountOf(f) > 0) {
            <span class="save-tag">Ahorra {{ money(discountOf(f)) }}</span>
          }
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1100px; margin: 0 auto; }
      .page-header { margin-bottom: 16px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 820px; }
      .muted { color: var(--fac-text-muted); font-size: 13px; }
      .panel { padding: 18px 20px; margin-bottom: 18px; border-radius: 16px; background: var(--fac-surface, #fff);
        box-shadow: 0 8px 24px -18px rgba(15, 23, 42, 0.35); display: flex; flex-direction: column; gap: 14px; }
      .panel-head { display: flex; gap: 12px; align-items: flex-start;
        mat-icon { color: #f59e0b; margin-top: 2px; }
        h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--fac-text); }
        p { margin: 2px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .commission-row { margin-bottom: 10px; mat-slide-toggle { min-width: 200px; } }
      .row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
        mat-form-field { width: 200px; }
        button[mat-flat-button] { height: 48px; border-radius: 12px; } }
      .packages { display: flex; flex-direction: column; gap: 10px; }
      .pkg { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; border-radius: 14px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        mat-form-field { width: 170px; }
        mat-form-field.discount { width: 130px; }
        &.off { opacity: 0.6; }
        &.new { border-style: dashed; } }
      .pays { display: flex; flex-direction: column; min-width: 120px;
        small { font-size: 12px; color: var(--fac-text-muted); }
        strong { font-size: 18px; font-weight: 700; color: #0b63f6; }
        .err { font-size: 12px; color: #dc2626; } }
      .save-tag { align-self: flex-start; margin-top: 2px; padding: 2px 8px; border-radius: 999px; background: #dcfce7; color: #15803d;
        font-size: 12px; font-weight: 700; }
      .add-btn { margin-left: auto; height: 48px; border-radius: 12px; }
      .pkg-actions { margin-left: auto; display: flex; }
      .new-pkg { padding-top: 12px; display: flex; flex-direction: column; gap: 10px;
        strong { font-size: 14px; color: var(--fac-text); } }
    `,
  ],
})
export class WalletConfigComponent implements OnInit {
  private readonly service = inject(StoreAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly config = signal<WalletConfig | null>(null);
  protected readonly packages = signal<PackageDraft[]>([]);
  protected readonly coinValue = signal(1000);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  protected min: number | null = null;
  protected max: number | null = null;
  protected withdrawMin: number | null = null;
  /** Días después de la cita para reembolsar una cita finalizada. */
  protected refundDays: number | null = 7;
  /** Minutos desde que se finaliza la cita hasta que se puede retirar (0 = de una vez). */
  protected holdMinutes: number | null = 0;
  protected readonly gateways = [
    { key: 'wallet' as const, label: 'Pago con billetera' },
    { key: 'wompi' as const, label: 'Pago con Wompi' },
  ];
  protected commissionForm: Record<'wallet' | 'wompi', GatewayCommission> = {
    wallet: { enabled: false, percent: 0 },
    wompi: { enabled: false, percent: 0 },
  };
  protected newForm: PackageForm = this.emptyForm();

  ngOnInit(): void {
    this.run(this.service.walletConfig(), null, () => this.loading.set(false));
  }

  protected money(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
  }

  /** Descuento en dinero del formulario (igual que lo calcula el servidor). */
  protected discountOf(f: PackageForm): number {
    const value = Number(f.value) || 0;
    const d = Number(f.discount) || 0;
    if (f.kind === 'PERCENT') return Math.round((value * d) / 100);
    if (f.kind === 'AMOUNT') return Math.round(d);
    return 0;
  }

  protected priceOf(f: PackageForm): number {
    return Math.max(0, (Number(f.value) || 0) - this.discountOf(f));
  }

  /** Mensaje si el formulario no sirve; null si se puede guardar. */
  protected formError(f: PackageForm): string | null {
    const value = Number(f.value) || 0;
    if (!(value > 0)) return 'Indique cuánto recibe.';
    if (value % this.coinValue()) return `Múltiplo de ${this.money(this.coinValue())}.`;
    if (f.kind === 'NONE') return null;
    const d = Number(f.discount) || 0;
    if (!(d > 0)) return 'Indique el descuento.';
    if (f.kind === 'PERCENT' && d >= 100) return 'Menor al 100%.';
    if (f.kind === 'AMOUNT' && d >= value) return 'Menor que lo que recibe.';
    return null;
  }

  protected changed(p: PackageDraft): boolean {
    const f = p.form;
    const kind: DiscountKind = p.discountType ?? 'NONE';
    return Number(f.value) !== p.value || f.kind !== kind || (f.kind !== 'NONE' && Number(f.discount) !== p.discountValue);
  }

  protected saveTopUp(): void {
    this.run(this.service.updateTopUp(Number(this.min), Number(this.max)), 'Rango de la recarga libre guardado');
  }

  protected saveCommissions(): void {
    const f = this.commissionForm;
    const bad = [f.wallet, f.wompi].some((c) => !(Number(c.percent) >= 0 && Number(c.percent) <= 100));
    if (bad) {
      this.snackBar.open('La comisión debe estar entre 0% y 100%.', 'Cerrar', { duration: 4000 });
      return;
    }
    const body = {
      wallet: { enabled: f.wallet.enabled, percent: Number(f.wallet.percent) },
      wompi: { enabled: f.wompi.enabled, percent: Number(f.wompi.percent) },
    };
    this.run(this.service.updateCommissions(body), 'Comisiones guardadas');
  }

  protected saveHoldMinutes(): void {
    const minutes = Number(this.holdMinutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 43200) {
      this.snackBar.open('Los minutos deben ser un número entero entre 0 y 43.200 (30 días).', 'Cerrar', { duration: 4000 });
      return;
    }
    this.run(this.service.updateWithdrawHold(minutes), 'Minutos de espera guardados');
  }

  protected saveRefundDays(): void {
    const days = Number(this.refundDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      this.snackBar.open('Los días deben ser un número entero entre 0 y 365.', 'Cerrar', { duration: 4000 });
      return;
    }
    this.run(this.service.updateRefundWindow(days), 'Días para reembolsar guardados');
  }

  protected saveWithdrawMin(): void {
    this.run(this.service.updateUserWithdrawMin(Number(this.withdrawMin)), 'Mínimo de retiro guardado');
  }

  protected addPackage(): void {
    this.run(this.service.createPackage(this.toInput(this.newForm)), 'Paquete agregado', () => (this.newForm = this.emptyForm()));
  }

  protected savePackage(p: PackageDraft): void {
    this.run(this.service.updatePackage(p.id, this.toInput(p.form)), 'Paquete guardado');
  }

  protected toggle(p: PackageDraft, isActive: boolean): void {
    this.run(this.service.updatePackage(p.id, { isActive }), isActive ? 'Paquete activado' : 'Paquete desactivado');
  }

  protected remove(p: PackageDraft): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar paquete',
        message: `¿Eliminar el paquete de ${this.money(p.value)}? Si prefiere ocultarlo un tiempo, desactívelo.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#dc2626',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.run(this.service.deletePackage(p.id), 'Paquete eliminado'));
  }

  /** Llama al backend, refresca todo con la respuesta y avisa. */
  private run(request: Observable<WalletConfig>, okMessage: string | null, done?: () => void): void {
    this.busy.set(true);
    request
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (config) => {
          this.apply(config);
          if (okMessage) this.snackBar.open(okMessage, 'Cerrar', { duration: 3000 });
          done?.();
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo guardar', 'Cerrar', { duration: 5000 });
          if (!okMessage) done?.();
        },
      });
  }

  private apply(config: WalletConfig): void {
    this.config.set(config);
    this.coinValue.set(config.coinValue || 1000);
    this.min = config.topUp?.min ?? null;
    this.max = config.topUp?.max ?? null;
    this.withdrawMin = config.userWithdrawMin ?? null;
    this.refundDays = config.refundWindowDays ?? 7;
    this.holdMinutes = config.withdrawHoldMinutes ?? 0;
    if (config.commissions) {
      this.commissionForm = {
        wallet: { ...config.commissions.wallet },
        wompi: { ...config.commissions.wompi },
      };
    }
    this.packages.set(
      config.packages.map((p) => ({
        ...p,
        form: { value: p.value, kind: p.discountType ?? 'NONE', discount: p.discountType ? p.discountValue : null },
      })),
    );
  }

  private emptyForm(): PackageForm {
    return { value: null, kind: 'NONE', discount: null };
  }

  private toInput(f: PackageForm) {
    return {
      value: Number(f.value),
      discountType: f.kind === 'NONE' ? null : f.kind,
      discountValue: f.kind === 'NONE' ? 0 : Number(f.discount),
    };
  }
}
