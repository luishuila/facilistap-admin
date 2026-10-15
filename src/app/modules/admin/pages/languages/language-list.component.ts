import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { finalize } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { LanguageService } from '../../services/language.service';
import { Language } from '../../../../core/models/language.interface';
import { translationsLabel } from '../../../../core/utils/localized-name.util';
import { PageEvent, RowAction, TableColumn } from '../../../../shared/components/data-table/data-table.types';
import { LanguageFormComponent, LanguageFormData } from './language-form.component';

type LanguageRow = Language & { display: string; translations: string; activeStatus: string; defaultStatus: string };

@Component({
  selector: 'app-language-list',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, MatIconModule, MatButtonModule, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Idiomas</h1>
          <p class="page-subtitle">
            Idiomas de la app. Los activos aparecen en el selector de la app y en las traducciones de países, departamentos y ciudades.
          </p>
        </div>
        <button mat-flat-button color="primary" class="add-btn" (click)="openForm()">
          <mat-icon>add</mat-icon>
          <span>Nuevo idioma</span>
        </button>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="pageRows()"
        [totalItems]="filtered().length"
        [pageSize]="pageSize()"
        [loading]="loading()"
        [showSearch]="true"
        [searchPlaceholder]="'Buscar por código o nombre...'"
        [showExport]="false"
        [showAddButton]="false"
        (pageChange)="onPage($event)"
        (searchChange)="search.set($event); page.set(0)"
        (rowAction)="onAction($event)"
      />
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
      .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
      .header-left { display: flex; flex-direction: column; gap: 4px; max-width: 760px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); line-height: 1.2; }
      .page-subtitle { margin: 0; font-size: 14px; color: var(--fac-text-muted); }
      .add-btn { border-radius: 12px; font-weight: 500; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; }
    `,
  ],
})
export class LanguageListComponent implements OnInit {
  private readonly languageService = inject(LanguageService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns: TableColumn[] = [
    { key: 'sortOrder', label: 'Orden', type: 'number', width: '80px', align: 'center' },
    { key: 'code', label: 'Código', width: '90px' },
    { key: 'display', label: 'Idioma' },
    { key: 'label', label: 'Nombre (español)' },
    { key: 'translations', label: 'Traducido a', width: '170px' },
    {
      key: 'activeStatus', label: 'Estado', type: 'status', width: '110px', align: 'center',
      statusMap: { ON: { label: 'Activo', color: '#22c55e' }, OFF: { label: 'Inactivo', color: '#94a3b8' } },
    },
    {
      key: 'defaultStatus', label: 'Por defecto', type: 'status', width: '120px', align: 'center',
      statusMap: { YES: { label: 'Por defecto', color: '#1daeff' }, NO: { label: '—', color: 'transparent' } },
    },
    { key: 'actions', label: 'Acciones', type: 'actions', width: '80px', align: 'center' },
  ];

  protected readonly rows = signal<LanguageRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter((r) =>
      [r.code, r.name, r.label].some((v) => (v ?? '').toLowerCase().includes(term)),
    );
  });
  protected readonly pageRows = computed(() =>
    this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()),
  );

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.languageService
      .getAll()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) =>
          this.rows.set(
            (res.data ?? []).map((l) => ({
              ...l,
              display: `${l.flag ? l.flag + ' ' : ''}${l.name}`,
              translations: translationsLabel(l.localizedName),
              activeStatus: l.isActive ? 'ON' : 'OFF',
              defaultStatus: l.isDefault ? 'YES' : 'NO',
            })),
          ),
        error: () => {
          this.rows.set([]);
          this.snackBar.open('Error al cargar los idiomas', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  protected onAction(e: RowAction<LanguageRow>): void {
    if (e.action === 'edit' || e.action === 'view') this.openForm(e.row);
    else if (e.action === 'toggle') this.toggleActive(e.row);
    else if (e.action === 'delete') this.confirmDelete(e.row);
  }

  protected openForm(language?: Language): void {
    this.dialog
      .open<LanguageFormComponent, LanguageFormData, boolean>(LanguageFormComponent, {
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
        disableClose: true,
        data: { language },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.load());
  }

  private toggleActive(row: Language): void {
    if (row.isDefault && row.isActive) {
      this.snackBar.open('No se puede desactivar el idioma por defecto', 'Cerrar', { duration: 4000 });
      return;
    }
    this.languageService
      .update(row.id, { name: row.name, isActive: !row.isActive })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(`${row.name} ${row.isActive ? 'desactivado' : 'activado'}`, 'Cerrar', { duration: 3000 });
          this.load();
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo cambiar el estado', 'Cerrar', { duration: 5000 }),
      });
  }

  private confirmDelete(row: Language): void {
    if (row.isDefault) {
      this.snackBar.open('No se puede eliminar el idioma por defecto', 'Cerrar', { duration: 4000 });
      return;
    }
    this.confirmDialog
      .confirm({
        title: 'Eliminar idioma',
        message: `¿Eliminar "${row.name}" (${row.code})? Deja de aparecer en la app. Las traducciones ya guardadas en países, departamentos y ciudades no se borran.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.languageService
          .delete(row.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Idioma eliminado', 'Cerrar', { duration: 3000 });
              this.load();
            },
            error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo eliminar el idioma', 'Cerrar', { duration: 5000 }),
          });
      });
  }
}
