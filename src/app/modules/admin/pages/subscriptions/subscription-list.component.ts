import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { SubscriptionService } from '../../services/subscription.service';
import {
  AdminSubscription,
  AdminTransaction,
  CYCLE_LABELS,
  SUBSCRIPTION_STATUS_MAP,
  SubscriptionCycle,
  SubscriptionStatus,
  TRANSACTION_STATUS_MAP,
  TransactionStatus,
} from '../../../../core/models/subscription.interface';
import {
  PageEvent,
  RowAction,
  RowActionOption,
  SortEvent,
  TableColumn,
} from '../../../../shared/components/data-table/data-table.types';
import { SubscriptionGrantComponent, SubscriptionGrantData } from './subscription-grant.component';
import { SubscriptionDetailComponent, SubscriptionDetailData } from './subscription-detail.component';

@Component({
  selector: 'app-subscription-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    DataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Suscripciones</h1>
          <p class="page-subtitle">Active, extienda o cancele la suscripción de los usuarios y revise sus pagos</p>
        </div>
        <button mat-flat-button color="primary" class="add-btn" (click)="openGrant()">
          <mat-icon>workspace_premium</mat-icon>
          <span>Activar suscripción</span>
        </button>
      </div>

      <mat-tab-group animationDuration="200ms" (selectedIndexChange)="onTabChange($event)">
        <mat-tab label="Suscripciones">
          <div class="filters-bar">
            <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
              <mat-label>Estado</mat-label>
              <mat-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); reloadSubs()">
                <mat-option [value]="''">Todos</mat-option>
                @for (s of statusList; track s.value) {
                  <mat-option [value]="s.value">{{ s.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
              <mat-label>Ciclo</mat-label>
              <mat-select [ngModel]="cycleFilter()" (ngModelChange)="cycleFilter.set($event); reloadSubs()">
                <mat-option [value]="''">Todos</mat-option>
                @for (c of cycleList; track c.value) {
                  <mat-option [value]="c.value">{{ c.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <app-data-table
            [columns]="subColumns"
            [data]="subscriptions()"
            [totalItems]="subTotal()"
            [pageSize]="subPageSize()"
            [loading]="subLoading()"
            [showSearch]="true"
            [searchPlaceholder]="'Buscar por nombre o email...'"
            [showExport]="false"
            [showAddButton]="false"
            (sortChange)="onSubSort($event)"
            (pageChange)="onSubPage($event)"
            (searchChange)="subSearch.set($event); reloadSubs()"
            [rowActions]="subActions"
            (rowAction)="onSubAction($event)"
          />
        </mat-tab>

        <mat-tab label="Pagos">
          <div class="filters-bar">
            <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
              <mat-label>Estado</mat-label>
              <mat-select [ngModel]="txStatusFilter()" (ngModelChange)="txStatusFilter.set($event); reloadTx()">
                <mat-option [value]="''">Todos</mat-option>
                @for (s of txStatusList; track s.value) {
                  <mat-option [value]="s.value">{{ s.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field" subscriptSizing="dynamic">
              <mat-label>Origen</mat-label>
              <mat-select [ngModel]="gatewayFilter()" (ngModelChange)="gatewayFilter.set($event); reloadTx()">
                <mat-option [value]="''">Todos</mat-option>
                <mat-option value="WOMPI">Wompi</mat-option>
                <mat-option value="ADMIN">Admin (manual)</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <app-data-table
            [columns]="txColumns"
            [data]="transactions()"
            [totalItems]="txTotal()"
            [pageSize]="txPageSize()"
            [loading]="txLoading()"
            [showSearch]="true"
            [searchPlaceholder]="'Buscar por referencia, nombre o email...'"
            [showExport]="false"
            [showAddButton]="false"
            (pageChange)="onTxPage($event)"
            (searchChange)="txSearch.set($event); reloadTx()"
            [rowActions]="txActions"
            (rowAction)="onTxAction($event)"
          />
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
      .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
      .header-left { display: flex; flex-direction: column; gap: 4px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: #1e293b; line-height: 1.2; }
      .page-subtitle { margin: 0; font-size: 14px; color: #94a3b8; }
      .add-btn { border-radius: 8px; font-weight: 500; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; }
      .filters-bar {
        display: flex; align-items: center; gap: 12px; margin: 16px 0; flex-wrap: wrap;
        padding: 16px 20px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      .filter-field { width: 180px; }
    `,
  ],
})
export class SubscriptionListComponent implements OnInit {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusList = (Object.keys(SUBSCRIPTION_STATUS_MAP) as SubscriptionStatus[]).map((value) => ({
    value,
    label: SUBSCRIPTION_STATUS_MAP[value].label,
  }));
  protected readonly cycleList = (Object.keys(CYCLE_LABELS) as SubscriptionCycle[]).map((value) => ({
    value,
    label: CYCLE_LABELS[value],
  }));
  protected readonly txStatusList = (Object.keys(TRANSACTION_STATUS_MAP) as TransactionStatus[]).map((value) => ({
    value,
    label: TRANSACTION_STATUS_MAP[value].label,
  }));
  private readonly cycleStatusMap = Object.fromEntries(
    this.cycleList.map((c) => [c.value, { label: c.label, color: '#009bff' }]),
  );

  protected readonly subActions: RowActionOption[] = [
    { action: 'extend', label: 'Agregar días / extender', icon: 'more_time' },
    { action: 'view', label: 'Ver detalle y pagos', icon: 'visibility' },
    { action: 'cancel', label: 'Cancelar suscripción', icon: 'block', danger: true },
  ];
  protected readonly txActions: RowActionOption[] = [
    { action: 'view', label: 'Ver suscripción del usuario', icon: 'visibility' },
  ];

  protected readonly subColumns: TableColumn[] = [
    { key: 'userName', label: 'Usuario', sortable: true },
    { key: 'userEmail', label: 'Email' },
    { key: 'status', label: 'Estado', sortable: true, type: 'status', width: '120px', align: 'center', statusMap: SUBSCRIPTION_STATUS_MAP },
    { key: 'billingCycle', label: 'Ciclo', sortable: true, type: 'status', width: '120px', align: 'center', statusMap: this.cycleStatusMap },
    { key: 'endAt', label: 'Vence', sortable: true, type: 'date', format: 'dd/MM/yyyy', width: '120px' },
    { key: 'daysLeft', label: 'Días', type: 'number', width: '80px', align: 'center' },
    { key: 'amount', label: 'Valor', sortable: true, type: 'number', width: '110px', align: 'right' },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  protected readonly txColumns: TableColumn[] = [
    { key: 'createdAt', label: 'Fecha', type: 'date', format: 'dd/MM/yyyy HH:mm', width: '150px' },
    { key: 'userName', label: 'Usuario' },
    { key: 'reference', label: 'Referencia' },
    { key: 'gateway', label: 'Origen', width: '100px', align: 'center' },
    { key: 'billingCycle', label: 'Ciclo', type: 'status', width: '120px', align: 'center', statusMap: this.cycleStatusMap },
    { key: 'amount', label: 'Valor', type: 'number', width: '110px', align: 'right' },
    { key: 'status', label: 'Estado', type: 'status', width: '120px', align: 'center', statusMap: TRANSACTION_STATUS_MAP },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  // Suscripciones
  protected readonly subscriptions = signal<AdminSubscription[]>([]);
  protected readonly subTotal = signal(0);
  protected readonly subLoading = signal(false);
  protected readonly subPage = signal(0);
  protected readonly subPageSize = signal(10);
  protected readonly subSearch = signal('');
  protected readonly subSortBy = signal('endAt');
  protected readonly subSortDir = signal<'asc' | 'desc'>('desc');
  protected readonly statusFilter = signal('');
  protected readonly cycleFilter = signal('');

  // Pagos
  protected readonly transactions = signal<AdminTransaction[]>([]);
  protected readonly txTotal = signal(0);
  protected readonly txLoading = signal(false);
  protected readonly txPage = signal(0);
  protected readonly txPageSize = signal(10);
  protected readonly txSearch = signal('');
  protected readonly txStatusFilter = signal('');
  protected readonly gatewayFilter = signal('');
  private txLoaded = false;

  ngOnInit(): void {
    this.loadSubs();
  }

  protected onTabChange(index: number): void {
    if (index === 1 && !this.txLoaded) this.loadTx();
  }

  protected reloadSubs(): void {
    this.subPage.set(0);
    this.loadSubs();
  }

  protected reloadTx(): void {
    this.txPage.set(0);
    this.loadTx();
  }

  private loadSubs(): void {
    this.subLoading.set(true);
    const filters: Record<string, unknown> = {};
    if (this.statusFilter()) filters['status'] = this.statusFilter();
    if (this.cycleFilter()) filters['billingCycle'] = this.cycleFilter();

    this.subscriptionService
      .getAll({
        page: this.subPage() + 1,
        limit: this.subPageSize(),
        search: this.subSearch() || undefined,
        sortBy: this.subSortBy(),
        sortOrder: this.subSortDir(),
        filters,
      })
      .pipe(
        finalize(() => this.subLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.subscriptions.set(res.items ?? []);
          this.subTotal.set(res.total ?? 0);
        },
        error: () => {
          this.subscriptions.set([]);
          this.subTotal.set(0);
          this.snackBar.open('Error al cargar suscripciones', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private loadTx(): void {
    this.txLoaded = true;
    this.txLoading.set(true);
    const filters: Record<string, unknown> = {};
    if (this.txStatusFilter()) filters['status'] = this.txStatusFilter();
    if (this.gatewayFilter()) filters['gateway'] = this.gatewayFilter();

    this.subscriptionService
      .getTransactions({
        page: this.txPage() + 1,
        limit: this.txPageSize(),
        search: this.txSearch() || undefined,
        sortOrder: 'desc',
        filters,
      })
      .pipe(
        finalize(() => this.txLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.transactions.set(res.items ?? []);
          this.txTotal.set(res.total ?? 0);
        },
        error: () => {
          this.transactions.set([]);
          this.txTotal.set(0);
          this.snackBar.open('Error al cargar pagos', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected onSubSort(e: SortEvent): void {
    this.subSortBy.set(e.active);
    this.subSortDir.set((e.direction || 'desc') as 'asc' | 'desc');
    this.reloadSubs();
  }

  protected onSubPage(e: PageEvent): void {
    this.subPage.set(e.pageIndex);
    this.subPageSize.set(e.pageSize);
    this.loadSubs();
  }

  protected onTxPage(e: PageEvent): void {
    this.txPage.set(e.pageIndex);
    this.txPageSize.set(e.pageSize);
    this.loadTx();
  }

  protected onSubAction(e: RowAction<AdminSubscription>): void {
    const row = e.row;
    if (e.action === 'view') this.openDetail(row.userId, row.userName, row.userEmail);
    else if (e.action === 'extend') this.openGrant(row);
    else if (e.action === 'cancel') this.confirmCancel(row);
  }

  protected onTxAction(e: RowAction<AdminTransaction>): void {
    if (e.action === 'view' || e.action === 'edit') this.openDetail(e.row.userId, e.row.userName, e.row.userEmail);
  }

  protected openGrant(row?: AdminSubscription): void {
    const data: SubscriptionGrantData = row
      ? { user: { id: row.userId, name: row.userName, email: row.userEmail }, endAt: row.endAt, status: row.status }
      : {};
    this.dialog
      .open<SubscriptionGrantComponent, SubscriptionGrantData, boolean>(SubscriptionGrantComponent, {
        width: '540px',
        autoFocus: false,
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.refreshAll());
  }

  private openDetail(userId: string, userName: string, userEmail: string | null): void {
    this.dialog
      .open<SubscriptionDetailComponent, SubscriptionDetailData, boolean>(SubscriptionDetailComponent, {
        width: '640px',
        maxHeight: '90vh',
        autoFocus: false,
        data: { userId, userName, userEmail },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changed) => changed && this.refreshAll());
  }

  private confirmCancel(row: AdminSubscription): void {
    if (row.status !== 'ACTIVE') {
      this.snackBar.open('La suscripción no está activa', 'Cerrar', { duration: 3000 });
      return;
    }
    this.confirmDialog
      .confirm({
        title: 'Cancelar suscripción',
        message: `La suscripción de ${row.userName} termina ahora y sus empleados quedan inactivos (salvo los que tengan agendas pendientes). ¿Continuar?`,
        confirmText: 'Cancelar suscripción',
        cancelText: 'Volver',
        icon: 'block',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.subscriptionService
          .cancel(row.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Suscripción cancelada', 'Cerrar', { duration: 3000 });
              this.refreshAll();
            },
            error: () => this.snackBar.open('No se pudo cancelar la suscripción', 'Cerrar', { duration: 5000 }),
          });
      });
  }

  private refreshAll(): void {
    this.loadSubs();
    if (this.txLoaded) this.loadTx();
  }
}
