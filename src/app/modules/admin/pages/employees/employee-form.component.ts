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
import { UserService } from '../../services/user.service';
import { ProviderService } from '../../services/provider.service';
import { Employee } from '../../../../core/models/employee.interface';
import { User } from '../../../../core/models/user.interface';
import { Provider } from '../../../../core/models/provider.interface';

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
  private readonly userService = inject(UserService);
  private readonly providerService = inject(ProviderService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;
  protected readonly users = signal<User[]>([]);
  protected readonly providers = signal<Provider[]>([]);

  constructor() {
    const employee = this.data?.employee;
    this.isEdit = !!employee;

    this.form = this.fb.group({
      usersId: [employee?.usersId ?? '', [Validators.required]],
      providersId: [employee?.providersId ?? null, [Validators.required]],
      position: [employee?.position ?? ''],
      hireDate: [employee?.hireDate ? new Date(employee.hireDate) : new Date(), [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.userService
      .getAll({ page: 1, limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.users.set(res?.items ?? []),
        error: () => {},
      });

    this.providerService
      .getAll({ page: 1, limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.providers.set(res?.items ?? []),
        error: () => {},
      });
  }

  protected userName(user: User): string {
    return [user.name, user.lastname].filter(Boolean).join(' ') || user.username;
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    this._submitting = true;

    const value = this.form.value;
    const hireDate = value.hireDate instanceof Date
      ? value.hireDate.toISOString().split('T')[0]
      : value.hireDate;

    const payload: Record<string, unknown> = {
      providersId: Number(value.providersId),
      position: value.position?.trim() || undefined,
      hireDate,
    };
    if (!this.isEdit) {
      payload['usersId'] = value.usersId;
    }

    const request$ = this.isEdit
      ? this.employeeService.update(this.data.employee!.id, payload)
      : this.employeeService.create(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit ? 'Empleado actualizado correctamente' : 'Empleado creado correctamente',
          'Cerrar',
          { duration: 3000 },
        );
        this.dialogRef.close(true);
      },
      error: (err: Error) => {
        this._submitting = false;
        this.snackBar.open(err?.message || 'Error al guardar el empleado', 'Cerrar', { duration: 5000 });
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
