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
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { EmployeeService } from '../../services/employee.service';
import { RoleService } from '../../services/role.service';
import { Employee } from '../../../../core/models/employee.interface';
import { Role } from '../../../../core/models/role.interface';

export interface EmployeeAssignRoleData {
  employee: Employee;
}

@Component({
  selector: 'app-employee-assign-role',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-assign-role.component.html',
  styleUrls: ['./employee-assign-role.component.scss'],
})
export class EmployeeAssignRoleComponent implements OnInit {
  private readonly dialogRef = inject<
    MatDialogRef<EmployeeAssignRoleComponent, boolean>
  >(MatDialogRef<EmployeeAssignRoleComponent, boolean>);
  private readonly data = inject<EmployeeAssignRoleData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(RoleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly employee: Employee;
  protected readonly form: FormGroup;
  protected readonly roles = signal<Role[]>([]);
  protected readonly rolesLoading = signal(false);

  constructor() {
    this.employee = this.data.employee;

    this.form = this.fb.group({
      roleId: [this.employee.roleId, [Validators.required]],
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

    const newRoleId = this.form.value.roleId;
    if (newRoleId === this.employee.roleId) {
      this.snackBar.open('El rol seleccionado es el mismo actual', 'Cerrar', {
        duration: 3000,
      });
      return;
    }

    this._submitting = true;

    this.employeeService
      .assignRole(this.employee.id, newRoleId)
      .subscribe({
        next: () => {
          this.snackBar.open('Rol asignado correctamente', 'Cerrar', {
            duration: 3000,
          });
          this.dialogRef.close(true);
        },
        error: () => {
          this._submitting = false;
          this.snackBar.open('Error al asignar rol', 'Cerrar', {
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
