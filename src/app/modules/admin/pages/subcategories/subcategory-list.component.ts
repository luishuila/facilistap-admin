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
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { SubcategoryService } from '../../services/subcategory.service';
import { CategoryService } from '../../services/category.service';
import { Subcategory } from '../../../../core/models/subcategory.interface';
import { Category, localizedText } from '../../../../core/models/category.interface';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
} from '../../../../shared/components/data-table/data-table.types';
import { SubcategoryFormComponent } from './subcategory-form.component';

/** Fila de la tabla: la subcategoría con sus textos ya resueltos por idioma. */
interface SubcategoryRow extends Subcategory {
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  categoryNameEs: string;
}

@Component({
  selector: 'app-subcategory-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subcategory-list.component.html',
  styleUrls: ['./subcategory-list.component.scss'],
})
export class SubcategoryListComponent implements OnInit {
  protected readonly categoryName = localizedText;

  private readonly subcategoryService = inject(SubcategoryService);
  private readonly categoryService = inject(CategoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly subcategories = signal<SubcategoryRow[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');
  protected readonly categoryFilter = new FormControl<number | null>(null);

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'img', label: 'Imagen', type: 'image', width: '90px', align: 'center' },
    { key: 'nameEs', label: 'Nombre (ES)' },
    { key: 'nameEn', label: 'Nombre (EN)' },
    { key: 'descriptionEs', label: 'Descripción' },
    { key: 'categoryNameEs', label: 'Categoría' },
    {
      key: 'isActive',
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
    {
      key: 'actions',
      label: 'Acciones',
      type: 'actions',
      width: '80px',
      align: 'center',
    },
  ];

  ngOnInit(): void {
    this.loadCategories();

    this.categoryFilter.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage.set(0);
        this.loadSubcategories();
      });
  }

  private loadCategories(): void {
    this.categoryService
      .getAll({ page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadSubcategories())
      )
      .subscribe({
        next: (res) => {
          this.categories.set(res?.items ?? []);
        },
        error: () => {
          this.categories.set([]);
          this.snackBar.open('Error al cargar categorías', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  protected loadSubcategories(): void {
    this.loading.set(true);

    const categoryId = this.categoryFilter.value;

    this.subcategoryService
      .getAll({
        page: this.currentPage() + 1,
        limit: this.pageSize(),
        search: this.searchTerm() || undefined,
        sortBy: this.sortActive() || undefined,
        sortOrder: this.sortDirection(),
        filters: categoryId ? { categoryId } : undefined,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.subcategories.set((res?.items ?? []).map((s) => this.toRow(s)));
          this.totalItems.set(res?.total ?? 0);
        },
        error: () => {
          this.subcategories.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar subcategorías', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  private toRow(subcategory: Subcategory): SubcategoryRow {
    return {
      ...subcategory,
      nameEs: localizedText(subcategory.name, 'es'),
      nameEn: subcategory.name?.en ?? '',
      descriptionEs: localizedText(subcategory.description, 'es'),
      categoryNameEs: localizedText(subcategory.categoryName, 'es'),
    };
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadSubcategories();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadSubcategories();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadSubcategories();
  }

  protected onRowAction(event: RowAction<Subcategory>): void {
    switch (event.action) {
      case 'edit':
        this.openFormDialog(event.row);
        break;
      case 'toggle':
        this.toggleSubcategory(event.row);
        break;
      case 'delete':
        this.confirmDelete(event.row);
        break;
    }
  }

  protected onAdd(): void {
    this.openFormDialog();
  }

  private openFormDialog(subcategory?: Subcategory): void {
    const dialogRef = this.dialog.open<
      SubcategoryFormComponent,
      { subcategory?: Subcategory },
      boolean
    >(SubcategoryFormComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data: { subcategory },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadSubcategories();
        }
      });
  }

  private toggleSubcategory(subcategory: Subcategory): void {
    this.subcategoryService
      .toggle(subcategory.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const newStatus = !subcategory.isActive;
          this.snackBar.open(
            `Subcategoría ${newStatus ? 'activada' : 'desactivada'} correctamente`,
            'Cerrar',
            { duration: 3000 }
          );
          this.loadSubcategories();
        },
        error: () => {
          this.snackBar.open('Error al cambiar estado', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  private confirmDelete(subcategory: Subcategory): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar Subcategoría',
        message: `¿Está seguro de eliminar la subcategoría "${localizedText(subcategory.name)}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteSubcategory(subcategory.id);
        }
      });
  }

  private deleteSubcategory(id: number): void {
    this.subcategoryService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Subcategoría eliminada correctamente', 'Cerrar', {
            duration: 3000,
          });
          this.loadSubcategories();
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'Error al eliminar subcategoría', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }
}
