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
import { PackageDiscountType, StoreAdminService, WalletConfig, WalletPackage } from '../../services/store.service';

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
