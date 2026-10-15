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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { StateService } from '../../services/state.service';
import { CountryService } from '../../services/country.service';
import { StateCountry } from '../../../../core/models/state.interface';
import { Country } from '../../../../core/models/country.interface';
import { TableColumn, SortEvent, PageEvent, RowAction } from '../../../../shared/components/data-table/data-table.types';
import { StateFormComponent } from './state-form.component';

@Component({
  selector: 'app-state-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './state-list.component.html',
  styleUrls: ['./state-list.component.scss'],
})
export class StateListComponent implements OnInit {
  private readonly stateService = inject(StateService);
  private readonly countryService = inject(CountryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly states = signal<StateCountry[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('stateName');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');
  protected readonly selectedCountryCode = signal<string | null>(null);
  protected readonly countries = signal<Country[]>([]);
  protected readonly countriesLoading = signal(false);

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'stateCode', label: 'Código', sortable: true, width: '100px' },
    { key: 'stateName', label: 'Departamento', sortable: true },
    { key: 'translations', label: 'Idiomas', width: '150px' },
    { key: 'regionState', label: 'Región', sortable: true },
    { key: 'countryCode', label: 'País', sortable: true, width: '100px' },
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
    this.loadStates();
  }

  private loadCountries(): void {
    this.countriesLoading.set(true);

    this.countryService
      .getAll({
        limit: 200,
        sortBy: 'countryName',
        sortOrder: 'asc',
      })
      .pipe(
        finalize(() => this.countriesLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.countries.set(res?.items ?? []);
        },
        error: () => {
          this.countries.set([]);
        },
      });
  }

  protected loadStates(): void {
    this.loading.set(true);

    const filters: Record<string, unknown> = {};
    if (this.selectedCountryCode()) {
      filters['countryCode'] = this.selectedCountryCode();
    }

    this.stateService
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
          this.states.set(res?.items ?? []);
          this.totalItems.set(res?.total ?? 0);
        },
        error: () => {
          this.states.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar departamentos', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected onCountryFilterChange(countryCode: string | null): void {
    this.selectedCountryCode.set(countryCode);
    this.currentPage.set(0);
    this.loadStates();
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadStates();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadStates();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadStates();
  }

  protected onRowAction(event: RowAction<StateCountry>): void {
    switch (event.action) {
      case 'edit':
        this.openFormDialog(event.row);
        break;
      case 'view':
        this.snackBar.open(
          `Departamento: ${event.row.stateName} (${event.row.stateCode}) - Región: ${event.row.regionState}`,
          'Cerrar',
          { duration: 5000 }
        );
        break;
    }
  }

  protected onAdd(): void {
    this.openFormDialog();
  }

  private openFormDialog(state?: StateCountry): void {
    const dialogRef = this.dialog.open<StateFormComponent, { state?: StateCountry }, boolean>(
      StateFormComponent,
      {
        width: '720px',
        maxWidth: '95vw',
        disableClose: true,
        autoFocus: false,
        data: { state },
      },
    );

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadStates();
        }
      });
  }
}
