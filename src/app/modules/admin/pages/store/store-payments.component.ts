import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageEvent, RowAction, RowActionOption, TableColumn } from '../../../../shared/components/data-table/data-table.types';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { AppointmentPaymentItem, StoreAdminService } from '../../services/store.service';
import { formatMoney } from '../../../../core/utils/money.util';

type Row = AppointmentPaymentItem & { methodLabel: string; amountLabel: string; commissionLabel: string; providerLabel: string; state: string };

/**
 * Pagos de citas hechos en la Tienda de la app. El dinero entra a la plataforma; aquí se
 * liquida al proveedor (monto - comisión de la tabla maestra → Tienda) y se marca como pagado.
 */
@Component({
  selector: 'app-store-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    DataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Tienda y liquidaciones</h1>
          <p class="page-subtitle">
            Agendas pagadas por los clientes en la Tienda (con Wompi o monedas). Liquide a cada proveedor lo que le corresponde
            (monto menos la comisión configurada en Tabla maestra → Tienda) y márquelo como pagado.
          </p>
        </div>
      </div>

      <div class="cards">
        <div class="card"><span>Por liquidar a proveedores</span><strong>{{ money(totals().pending) }}</strong><small>{{ totals().pendingCount }} pagos</small></div>
        <div class="card"><span>Comisión de la plataforma</span><strong>{{ money(totals().commission) }}</strong><small>en lo filtrado</small></div>
        <div class="card"><span>Cobrado a clientes</span><strong>{{ money(totals().gross) }}</strong><small>en lo filtrado</small></div>
      </div>

      <div class="filters">
        <mat-button-toggle-group [value]="settled()" (change)="setSettled($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle [value]="false">Por liquidar</mat-button-toggle>
          <mat-button-toggle [value]="true">Liquidados</mat-button-toggle>
          <mat-button-toggle [value]="null">Todos</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Proveedor</mat-label>
          <mat-select [value]="provider()" (selectionChange)="provider.set($event.value); page.set(0)">
            <mat-option [value]="null">Todos</mat-option>
            @for (p of providers(); track p.id) {
              <mat-option [value]="p.id">{{ p.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (pendingInView().length) {
          <button mat-flat-button color="primary" class="settle-btn" (click)="settleAll()" [disabled]="busy()">
            <mat-icon>payments</mat-icon>
            Liquidar {{ pendingInView().length }} ({{ money(sum(pendingInView())) }})
          </button>
        }
      </div>

      <app-data-table
        [columns]="columns"
        [data]="pageRows()"
        [totalItems]="filtered().length"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por proveedor o cliente...'"
        [showExport]="false"
        [showAddButton]="false"
        [rowActions]="rowActions"
        (pageChange)="onPage($event)"
        (searchChange)="search.set($event); page.set(0)"
        (rowAction)="onAction($event)"
      />
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
      .page-header { margin-bottom: 16px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 820px; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px; }
      .card { padding: 16px 18px; border-radius: 16px; background: var(--fac-surface, #fff); box-shadow: 0 8px 24px -18px rgba(15, 23, 42, 0.35);
        display: flex; flex-direction: column; gap: 4px;
        span { font-size: 13px; color: var(--fac-text-muted); }
        strong { font-size: 22px; font-weight: 700; color: var(--fac-text); }
        small { font-size: 12px; color: var(--fac-text-muted); } }
      .card:first-child strong { color: #0b63f6; }
      .filters { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
        mat-form-field { min-width: 240px; } }
      .settle-btn { border-radius: 12px; height: 44px; display: inline-flex; align-items: center; gap: 6px; }
    `,
  ],
})
export class StorePaymentsComponent implements OnInit {
  private readonly service = inject(StoreAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rowActions: RowActionOption[] = [{ action: 'settle', label: 'Marcar como liquidado', icon: 'payments' }];

  protected readonly columns: TableColumn[] = [
    { key: 'paidAt', label: 'Pagado', type: 'date', format: 'dd/MM/yyyy HH:mm', width: '150px' },
    { key: 'providerLabel', label: 'Proveedor', subKey: 'userName' },
    { key: 'methodLabel', label: 'Medio', width: '110px' },
    { key: 'amountLabel', label: 'Cobrado', width: '130px' },
    { key: 'commissionLabel', label: 'Comisión', width: '150px' },
    { key: 'state', label: 'Liquidación', type: 'status', width: '130px', align: 'center',
      statusMap: { PENDING: { label: 'Por liquidar', color: '#f59e0b' }, DONE: { label: 'Liquidado', color: '#22c55e' } } },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly settled = signal<boolean | null>(false);
  protected readonly provider = signal<number | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly providers = computed(() => {
    const map = new Map<number, string>();
    this.rows().forEach((r) => r.providerId && map.set(r.providerId, r.providerName));
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const p = this.provider();
    return this.rows().filter(
      (r) => (!p || r.providerId === p) && (!term || [r.providerName, r.userName].some((v) => (v ?? '').toLowerCase().includes(term))),
    );
  });
  protected readonly pageRows = computed(() => this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));
  protected readonly pendingInView = computed(() => this.filtered().filter((r) => !r.settledAt));
  protected readonly totals = computed(() => {
    const list = this.filtered();
    const pending = list.filter((r) => !r.settledAt);
    return {
      pending: this.sum(pending),
      pendingCount: pending.length,
      commission: list.reduce((s, r) => s + r.commissionAmount, 0),
      gross: list.reduce((s, r) => s + r.amount, 0),
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected money(v: number): string {
    return formatMoney(v);
  }

  protected sum(list: Row[]): number {
    return list.reduce((s, r) => s + r.providerAmount, 0);
  }

  protected setSettled(v: boolean | null): void {
    this.settled.set(v);
    this.page.set(0);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .payments(this.settled())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) =>
          this.rows.set(
            list.map((p) => ({
              ...p,
              providerLabel: `${p.providerName} → ${this.money(p.providerAmount)}`,
              methodLabel: p.method === 'COINS' ? 'Billetera' : 'Wompi',
              amountLabel: this.money(p.amount),
              commissionLabel: `${this.money(p.commissionAmount)} (${p.commissionPercent}%)`,
              state: p.settledAt ? 'DONE' : 'PENDING',
            })),
          ),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar los pagos', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  protected onAction(e: RowAction<Row>): void {
    if (e.action !== 'settle') return;
    if (e.row.settledAt) {
      this.snackBar.open(`Ya liquidado por ${e.row.settledByName ?? 'un administrador'}`, 'Cerrar', { duration: 3000 });
      return;
    }
    this.confirmSettle([e.row]);
  }

  protected settleAll(): void {
    this.confirmSettle(this.pendingInView());
  }

  private confirmSettle(list: Row[]): void {
    const providers = new Set(list.map((r) => r.providerName));
    this.confirmDialog
      .confirm({
        title: 'Marcar como liquidado',
        message: `Confirme que ya le pagó ${this.money(this.sum(list))} a ${providers.size === 1 ? [...providers][0] : providers.size + ' proveedores'} (${list.length} pagos).`,
        confirmText: 'Sí, ya se pagó',
        cancelText: 'Cancelar',
        icon: 'payments',
        color: '#0b63f6',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.service
          .settle(list.map((r) => r.id))
          .pipe(
            finalize(() => this.busy.set(false)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe({
            next: (res) => {
              this.snackBar.open(`${res.settled} pagos liquidados (${this.money(res.total)})`, 'Cerrar', { duration: 3500 });
              this.load();
            },
            error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo liquidar', 'Cerrar', { duration: 5000 }),
          });
      });
  }
}
