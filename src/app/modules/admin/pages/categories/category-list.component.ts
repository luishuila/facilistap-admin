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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { CategoryService } from '../../services/category.service';
import { Category, localizedText } from '../../../../core/models/category.interface';
import { TableColumn, SortEvent, PageEvent, RowAction } from '../../../../shared/components/data-table/data-table.types';
import { CategoryFormComponent } from './category-form.component';

/** Fila de la tabla: la categoria con sus textos ya resueltos por idioma. */
interface CategoryRow extends Category {
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatDialogModule,
    MatSnackBarModule,
    MatIconModule,
    MatButtonModule,
    DataTableComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-list.component.html',
  styleUrls: ['./category-list.component.scss'],
})
export class CategoryListComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categories = signal<CategoryRow[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('name');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'img', label: 'Imagen', type: 'image', width: '90px', align: 'center' },
    { key: 'nameEs', label: 'Nombre (ES)' },
    { key: 'nameEn', label: 'Nombre (EN)' },
    { key: 'descriptionEs', label: 'Descripción' },
    { key: 'subcategoriesCount', label: 'Subcategorías', sortable: true, type: 'number', width: '120px', align: 'center' },
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
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  ngOnInit(): void {
    this.loadCategories();
  }

  protected loadCategories(): void {
    this.loading.set(true);

    this.categoryService
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
          this.categories.set((res?.items ?? []).map((c) => this.toRow(c)));
          this.totalItems.set(res?.total ?? 0);
        },
        error: () => {
          this.categories.set([]);
          this.totalItems.set(0);
          this.snackBar.open('Error al cargar categorías', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private toRow(category: Category): CategoryRow {
    return {
      ...category,
      nameEs: localizedText(category.name, 'es'),
      nameEn: category.name?.en ?? '',
      descriptionEs: localizedText(category.description, 'es'),
    };
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadCategories();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadCategories();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadCategories();
  }

  protected onRowAction(event: RowAction<Category>): void {
    switch (event.action) {
      case 'edit':
        this.openFormDialog(event.row);
        break;
      case 'toggle':
        this.toggleCategory(event.row);
        break;
      case 'delete':
        this.confirmDelete(event.row);
        break;
    }
  }

  protected onAdd(): void {
    this.openFormDialog();
  }

  private openFormDialog(category?: Category): void {
    const dialogRef = this.dialog.open<
      CategoryFormComponent,
      { category?: Category },
      boolean
    >(CategoryFormComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data: { category },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadCategories();
        }
      });
  }

  private toggleCategory(category: Category): void {
    this.categoryService
      .toggle(category.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const newStatus = !category.isActive;
          this.snackBar.open(
            `Categoría ${newStatus ? 'activada' : 'desactivada'} correctamente`,
            'Cerrar',
            { duration: 3000 }
          );
          this.loadCategories();
        },
        error: () => {
          this.snackBar.open('Error al cambiar estado', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private confirmDelete(category: Category): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar Categoría',
        message: `¿Está seguro de eliminar la categoría "${localizedText(category.name)}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteCategory(category.id);
        }
      });
  }

  private deleteCategory(id: number): void {
    this.categoryService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Categoría eliminada correctamente', 'Cerrar', { duration: 3000 });
          this.loadCategories();
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'Error al eliminar categoría', 'Cerrar', { duration: 5000 });
        },
      });
  }
}
