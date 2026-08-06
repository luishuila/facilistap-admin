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

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { EmployeeService } from '../employee.service';
import { Employee } from '../../../core/models/employee.interface';
import {
  TableColumn,
  SortEvent,
  PageEvent,
  RowAction,
} from '../../../shared/components/data-table/data-table.types';
import { EmployeeFormComponent } from '../components/employee-form.component';
import { EmployeeAssignRoleComponent } from '../components/employee-assign-role.component';

@Component({
  selector: 'app-employee-list',
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
    LoadingSpinnerComponent,
    EmptyStateComponent,
    StatusBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-list.component.html',
  styleUrls: ['./employee-list.component.scss'],
})
export class EmployeeListComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly employees = signal<Employee[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly loading = signal(false);
  protected readonly currentPage = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly searchTerm = signal('');
  protected readonly sortActive = signal('id');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');

  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, type: 'number', width: '80px' },
    { key: 'firstName', label: 'Nombre', sortable: true },
    { key: 'lastName', label: 'Apellido', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Teléfono', width: '140px' },
    { key: 'roleName', label: 'Rol', width: '130px' },
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
    { key: 'hireDate', label: 'Contratación', sortable: true, type: 'date', width: '130px', align: 'center' },
    {
      key: 'actions',
      label: 'Acciones',
      type: 'actions',
      width: '120px',
      align: 'center',
    },
  ];

  ngOnInit(): void {
    this.loadEmployees();
  }

  protected loadEmployees(): void {
    this.loading.set(true);

    this.employeeService
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
          this.employees.set(res.items);
          this.totalItems.set(res.total);
        },
        error: () => {
          this.snackBar.open('Error al cargar empleados', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  protected onSortChange(event: SortEvent): void {
    this.sortActive.set(event.active);
    this.sortDirection.set(event.direction as 'asc' | 'desc');
    this.currentPage.set(0);
    this.loadEmployees();
  }

  protected onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadEmployees();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(0);
    this.loadEmployees();
  }

  protected onRowAction(event: RowAction<Employee>): void {
    switch (event.action) {
      case 'edit':
        this.openFormDialog(event.row);
        break;
      case 'toggle':
        this.toggleEmployee(event.row);
        break;
      case 'delete':
        this.confirmDelete(event.row);
        break;
      case 'change-role':
        this.openAssignRoleDialog(event.row);
        break;
    }
  }

  protected onAdd(): void {
    this.openFormDialog();
  }

  private openFormDialog(employee?: Employee): void {
    const dialogRef = this.dialog.open<
      EmployeeFormComponent,
      { employee?: Employee },
      boolean
    >(EmployeeFormComponent, {
      width: '560px',
      disableClose: true,
      autoFocus: false,
      data: { employee },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadEmployees();
        }
      });
  }

  private openAssignRoleDialog(employee: Employee): void {
    const dialogRef = this.dialog.open<
      EmployeeAssignRoleComponent,
      { employee: Employee },
      boolean
    >(EmployeeAssignRoleComponent, {
      width: '480px',
      disableClose: true,
      autoFocus: false,
      data: { employee },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.loadEmployees();
        }
      });
  }

  private toggleEmployee(employee: Employee): void {
    this.employeeService
      .toggle(employee.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const newStatus = !employee.isActive;
          this.snackBar.open(
            `Empleado ${newStatus ? 'activado' : 'desactivado'} correctamente`,
            'Cerrar',
            { duration: 3000 }
          );
          this.loadEmployees();
        },
        error: () => {
          this.snackBar.open('Error al cambiar estado', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  private confirmDelete(employee: Employee): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar Empleado',
        message: `¿Está seguro de eliminar al empleado "${employee.firstName} ${employee.lastName}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteEmployee(employee.id);
        }
      });
  }

  private deleteEmployee(id: number): void {
    this.employeeService
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Empleado eliminado correctamente', 'Cerrar', {
            duration: 3000,
          });
          this.loadEmployees();
        },
        error: () => {
          this.snackBar.open('Error al eliminar empleado', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }
}
