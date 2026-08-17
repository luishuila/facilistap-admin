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
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { CityService } from '../../services/city.service';
import { City } from '../../../../core/models/city.interface';
import { TableColumn, SortEvent, PageEvent, RowAction } from '../../../../shared/components/data-table/data-table.types';

@Component({
  selector: 'app-city-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './city-list.component.html',
  styleUrls: ['./city-list.component.scss'],
})
export class CityListComponent implements OnInit {
  private readonly cityService = inject(CityService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cities = signal<City[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('cityName');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');
  protected readonly selectedStateCode = signal<string | null>(null);

  protected readonly stateCodes = signal<string[]>([]);

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'cityName', label: 'Ciudad', sortable: true },
    { key: 'stateCode', label: 'Departamento', sortable: true, width: '120px' },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      type: 'status',
      width: '110px',
      align: 'center',
      statusMap: {
        true: { label: 'Activo', color: '#22c55e' },
        false: { label: 'Inactivo', color: '#94a3b8' },
      },
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  ngOnInit(): void {
    this.loadCities();
  }

  protected loadCities(): void {
    this.loading.set(true);

    const filters: Record<string, unknown> = {};
    if (this.selectedStateCode()) {
      filters['stateCode'] = this.selectedStateCode();
    }

    this.cityService
      .getAll({
        page: this.currentPage() + 1,
        limit: this.pageSize(),
        search: this.searchTerm() || undefined,
        sortBy: this.sortActive(),
        sortOrder: this.sortDirection(),
        filters,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.cities.set(res?.items ?? []);
          this.totalItems.set(res?.total ?? 0);

          if (!this.selectedStateCode()) {
            const codes = [...new Set((res?.items ?? []).map((c) => c.stateCode))].sort();
            this.stateCodes.set(codes);
          }
        },
        error: () => {
          this.cities.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar ciudades', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected onStateCodeFilterChange(stateCode: string | null): void {
    this.selectedStateCode.set(stateCode);
    this.currentPage.set(0);
    this.loadCities();
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadCities();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadCities();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadCities();
  }

  protected onRowAction(event: RowAction<City>): void {
    if (event.action === 'view') {
      this.snackBar.open(
        `Ciudad: ${event.row.cityName} - Departamento: ${event.row.stateCode}`,
        'Cerrar',
        { duration: 5000 }
      );
    }
  }
}
