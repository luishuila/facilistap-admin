import {
  Component,
  OnInit,
  inject,
  signal,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { EmployeeService } from '../../services/employee.service';
import { RoleService } from '../../services/role.service';
import { Employee } from '../../../../core/models/employee.interface';
import { Role } from '../../../../core/models/role.interface';

export interface EmployeeFormData {
  employee?: Employee;
}

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-form.component.html',
  styleUrls: ['./employee-form.component.scss'],
})
export class EmployeeFormComponent implements OnInit {
  private readonly dialogRef = inject<
    MatDialogRef<EmployeeFormComponent, boolean>
  >(MatDialogRef<EmployeeFormComponent, boolean>);
  private readonly data = inject<EmployeeFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(RoleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;
  protected readonly roles = signal<Role[]>([]);
  protected readonly rolesLoading = signal(false);

  constructor() {
    const employee = this.data?.employee;
    this.isEdit = !!employee;

    this.form = this.fb.group({
      firstName: [employee?.firstName ?? '', [Validators.required, Validators.maxLength(100)]],
      lastName: [employee?.lastName ?? '', [Validators.required, Validators.maxLength(100)]],
      email: [employee?.email ?? '', [Validators.required, Validators.email]],
      phone: [employee?.phone ?? ''],
      roleId: [employee?.roleId ?? '', [Validators.required]],
      hireDate: [employee?.hireDate ? new Date(employee.hireDate) : new Date(), [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  private loadRoles(): void {
    this.rolesLoading.set(true);
    this.roleService
      .getAll({ limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.roles.set(res.items);
          this.rolesLoading.set(false);
        },
        error: () => {
          this.rolesLoading.set(false);
        },
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this._submitting) {
      return;
    }

    this._submitting = true;

    const hireDateValue = this.form.value.hireDate;
    const hireDateStr =
      hireDateValue instanceof Date
        ? hireDateValue.toISOString().split('T')[0]
        : hireDateValue;

    const formValue = {
      firstName: this.form.value.firstName?.trim(),
      lastName: this.form.value.lastName?.trim(),
      email: this.form.value.email?.trim(),
      phone: this.form.value.phone?.trim() || null,
      roleId: this.form.value.roleId,
      hireDate: hireDateStr,
    };

    const request$ = this.isEdit
      ? this.employeeService.update(this.data!.employee!.id, formValue)
      : this.employeeService.create(formValue);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit
            ? 'Empleado actualizado correctamente'
            : 'Empleado creado correctamente',
          'Cerrar',
          { duration: 3000 }
        );
        this.dialogRef.close(true);
      },
      error: () => {
        this._submitting = false;
        this.snackBar.open('Error al guardar el empleado', 'Cerrar', {
          duration: 5000,
        });
      },
    });
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }

  private _submitting = false;

  protected get submitting(): boolean {
    return this._submitting;
  }
}
