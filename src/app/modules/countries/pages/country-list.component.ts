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
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { CountryService } from '../country.service';
import { Country } from '../../../core/models/country.interface';
import { TableColumn, SortEvent, PageEvent, RowAction } from '../../../shared/components/data-table/data-table.types';

@Component({
  selector: 'app-country-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatSnackBarModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './country-list.component.html',
  styleUrls: ['./country-list.component.scss'],
})
export class CountryListComponent implements OnInit {
  private readonly countryService = inject(CountryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly countries = signal<Country[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('countryName');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'countryCode', label: 'Código', sortable: true, width: '100px' },
    { key: 'countryName', label: 'País', sortable: true },
    { key: 'countryContinent', label: 'Continente', sortable: true },
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
    this.loadCountries();
  }

  protected loadCountries(): void {
    this.loading.set(true);

    this.countryService
      .getAll({
        page: this.currentPage() + 1,
        limit: this.pageSize(),
        search: this.searchTerm() || undefined,
        sortBy: this.sortActive(),
        sortOrder: this.sortDirection(),
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.countries.set(res?.items ?? []);
          this.totalItems.set(res?.total ?? 0);
        },
        error: () => {
          this.countries.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar países', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadCountries();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadCountries();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadCountries();
  }

  protected onRowAction(event: RowAction<Country>): void {
    if (event.action === 'view') {
      this.snackBar.open(
        `País: ${event.row.countryName} (${event.row.countryCode}) - Continente: ${event.row.countryContinent}`,
        'Cerrar',
        { duration: 5000 }
      );
    }
  }
}
