import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageEvent, RowAction, RowActionOption, TableColumn } from '../../../../shared/components/data-table/data-table.types';
import { ProviderWithdrawalItem, StoreAdminService, WithdrawalStatus } from '../../services/store.service';
import { WithdrawalDialogComponent, WithdrawalDialogData } from './withdrawal-dialog.component';

type Row = ProviderWithdrawalItem & { amountLabel: string; methodLabel: string };

const STATUS_MAP = {
  PENDING: { label: 'Por pagar', color: '#f59e0b' },
  PAID: { label: 'Pagado', color: '#22c55e' },
  REJECTED: { label: 'Rechazado', color: '#ef4444' },
};

/**
 * Retiros de la billetera de los negocios: el dueño pide el retiro de lo que ganó con las citas
 * pagadas en la app (ya sin comisión ni reembolsos). Aquí se transfiere y se marca pagado, o se rechaza.
 */
@Component({
  selector: 'app-provider-withdrawals',
  standalone: true,
  imports: [CommonModule, MatButtonToggleModule, MatDialogModule, MatSnackBarModule, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <h1 class="page-title">Retiros de negocios</h1>
        <p class="page-subtitle">
          Lo que los negocios piden retirar de su billetera (citas pagadas en la app, ya sin la comisión de FacilisTap ni los
          reembolsos). Transfiera a la cuenta indicada y márquelo como pagado; al hacerlo, sus citas quedan liquidadas.
        </p>
      </div>

      <div class="cards">
        <div class="card"><span>Por pagar</span><strong>{{ money(totals().pending) }}</strong><small>{{ totals().pendingCount }} retiros</small></div>
        <div class="card"><span>Pagado</span><strong>{{ money(totals().paid) }}</strong><small>en lo filtrado</small></div>
      </div>

      <div class="filters">
        <mat-button-toggle-group [value]="status()" (change)="setStatus($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="PENDING">Por pagar</mat-button-toggle>
          <mat-button-toggle value="PAID">Pagados</mat-button-toggle>
          <mat-button-toggle value="REJECTED">Rechazados</mat-button-toggle>
          <mat-button-toggle [value]="null">Todos</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="pageRows()"
        [totalItems]="filtered().length"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por negocio o titular...'"
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
      .card:first-child strong { color: #f59e0b; }
      .filters { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    `,
  ],
})
export class ProviderWithdrawalsComponent implements OnInit {
  private readonly service = inject(StoreAdminService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rowActions: RowActionOption[] = [
    { action: 'pay', label: 'Marcar pagado', icon: 'payments' },
    { action: 'reject', label: 'Rechazar', icon: 'block' },
  ];

  protected readonly columns: TableColumn[] = [
    { key: 'createdAt', label: 'Solicitado', type: 'date', format: 'dd/MM/yyyy HH:mm', width: '150px' },
    { key: 'providerName', label: 'Negocio', subKey: 'requestedByName' },
    { key: 'amountLabel', label: 'Monto', width: '130px' },
    { key: 'methodLabel', label: 'A dónde', subKey: 'accountLabel' },
    { key: 'status', label: 'Estado', type: 'status', width: '120px', align: 'center', statusMap: STATUS_MAP },
    { key: 'reviewedByName', label: 'Revisó', width: '150px' },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(false);
  protected readonly status = signal<WithdrawalStatus | null>('PENDING');
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.rows().filter((r) => !term || [r.providerName, r.account?.holderName, r.requestedByName].some((v) => (v ?? '').toLowerCase().includes(term)));
  });
  protected readonly pageRows = computed(() => this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));
  protected readonly totals = computed(() => {
    const list = this.filtered();
    const pending = list.filter((r) => r.status === 'PENDING');
    return {
      pending: pending.reduce((s, r) => s + r.amount, 0),
      pendingCount: pending.length,
      paid: list.filter((r) => r.status === 'PAID').reduce((s, r) => s + r.amount, 0),
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected money(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
  }

  protected setStatus(v: WithdrawalStatus | null): void {
    this.status.set(v);
    this.page.set(0);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .withdrawals(this.status())
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) =>
          this.rows.set(
            list.map((w) => ({
              ...w,
              amountLabel: this.money(w.amount),
              methodLabel: w.method === 'BANK_ACCOUNT' ? `Cuenta ${w.account?.bankName ?? ''}`.trim() : w.method === 'NEQUI' ? 'Nequi' : 'Daviplata',
              accountLabel: w.method === 'BANK_ACCOUNT' ? `${w.account?.accountNumber ?? ''} · ${w.account?.holderName ?? ''}` : `${w.account?.phone ?? ''} · ${w.account?.holderName ?? ''}`,
            } as Row)),
          ),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar los retiros', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  protected onAction(e: RowAction<Row>): void {
    if (e.row.status !== 'PENDING') {
      this.snackBar.open('Este retiro ya fue revisado.', 'Cerrar', { duration: 4000 });
      return;
    }
    const mode = e.action === 'reject' ? 'reject' : 'pay';
    this.dialog
      .open<WithdrawalDialogComponent, WithdrawalDialogData, { reference?: string; note?: string }>(WithdrawalDialogComponent, {
        width: '520px',
        maxWidth: '96vw',
        autoFocus: false,
        data: { mode, item: e.row },
      })
      .afterClosed()
      .subscribe((r) => {
        if (!r) return;
        const req$ = mode === 'pay' ? this.service.markWithdrawalPaid(e.row.id, r.reference) : this.service.rejectWithdrawal(e.row.id, r.note ?? '');
        req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.snackBar.open(mode === 'pay' ? 'Retiro marcado como pagado; se avisó al negocio' : 'Retiro rechazado; se avisó al negocio', 'Cerrar', { duration: 4000 });
            this.load();
          },
          error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo completar la acción', 'Cerrar', { duration: 5000 }),
        });
      });
  }
}
