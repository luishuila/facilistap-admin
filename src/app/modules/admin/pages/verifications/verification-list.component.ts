import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageEvent, RowAction, RowActionOption, TableColumn } from '../../../../shared/components/data-table/data-table.types';
import { VerificationItem, VerificationService, VerificationStatus } from '../../services/verification.service';
import { VerificationDetailComponent } from './verification-detail.component';

type Row = VerificationItem & { subject: string; owner: string; amountLabel: string };

const STATUS_MAP = {
  AWAITING_PAYMENT: { label: 'Pago pendiente', color: '#7c3aed' },
  PENDING: { label: 'En revisión', color: '#f59e0b' },
  APPROVED: { label: 'Verificado', color: '#0b63f6' },
  REJECTED: { label: 'Rechazado', color: '#ef4444' },
};

@Component({
  selector: 'app-verification-list',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, MatButtonToggleModule, MatIconModule, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Verificaciones</h1>
          <p class="page-subtitle">
            Solicitudes de la insignia de verificado (producto aparte de la suscripción; precio y vigencia en Tabla maestra → Verificación de cuentas).
            Solo se revisan las pagadas. El usuario y cada proveedor se verifican por separado.
          </p>
        </div>
      </div>

      <div class="filters">
        <mat-button-toggle-group [value]="status()" (change)="setStatus($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="PENDING">En revisión</mat-button-toggle>
          <mat-button-toggle value="APPROVED">Verificadas</mat-button-toggle>
          <mat-button-toggle value="REJECTED">Rechazadas</mat-button-toggle>
          <mat-button-toggle value="AWAITING_PAYMENT">Pago pendiente</mat-button-toggle>
          <mat-button-toggle [value]="null">Todas</mat-button-toggle>
        </mat-button-toggle-group>
        <span class="total">{{ filtered().length }} solicitudes</span>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="pageRows()"
        [totalItems]="filtered().length"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por nombre, usuario, email o negocio...'"
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
      .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 760px; }
      .filters { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
      .total { font-size: 14px; color: var(--fac-text-muted); }
    `,
  ],
})
export class VerificationListComponent implements OnInit {
  private readonly service = inject(VerificationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rowActions: RowActionOption[] = [{ action: 'review', label: 'Revisar', icon: 'fact_check' }];

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', type: 'number', width: '70px' },
    { key: 'subject', label: 'Tipo', width: '110px' },
    { key: 'owner', label: 'Cuenta / negocio', subKey: 'userEmail' },
    { key: 'createdAt', label: 'Enviada', type: 'date', format: 'dd/MM/yyyy HH:mm', width: '150px' },
    { key: 'amountLabel', label: 'Pago', width: '120px' },
    { key: 'status', label: 'Estado', type: 'status', width: '130px', align: 'center', statusMap: STATUS_MAP },
    { key: 'reviewedByName', label: 'Revisó', width: '160px' },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(false);
  protected readonly status = signal<VerificationStatus | null>('PENDING');
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.rows().filter(
      (r) => !term || [r.userName, r.username, r.userEmail, r.providerName].some((v) => (v ?? '').toLowerCase().includes(term)),
    );
  });
  protected readonly pageRows = computed(() =>
    this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()),
  );

  ngOnInit(): void {
    this.load();
  }

  protected setStatus(value: VerificationStatus | null): void {
    this.status.set(value);
    this.page.set(0);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .list(this.status())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) =>
          this.rows.set(
            list.map((v) => ({
              ...v,
              subject: v.subjectType === 'PROVIDER' ? 'Proveedor' : 'Usuario',
              amountLabel: v.amount > 0 ? `${v.currency} ${v.amount.toLocaleString('es-CO')}${v.paidAt ? '' : ' (sin pagar)'}` : 'Gratis',
              owner: v.subjectType === 'PROVIDER' ? `${v.providerName} (de ${v.userName})` : `${v.userName}${v.username ? ' · @' + v.username : ''}`,
            })),
          ),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar las verificaciones', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  protected onAction(e: RowAction<Row>): void {
    if (e.action !== 'review') return;
    this.dialog
      .open<VerificationDetailComponent, { id: number }, boolean>(VerificationDetailComponent, {
        width: '880px',
        maxWidth: '96vw',
        autoFocus: false,
        data: { id: e.row.id },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changed) => changed && this.load());
  }
}
