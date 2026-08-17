import {
  Component,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ProviderService } from '../../services/provider.service';
import { Provider } from '../../../../core/models/provider.interface';

export interface ProviderFormData {
  provider?: Provider;
}

@Component({
  selector: 'app-provider-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './provider-form.component.html',
  styleUrls: ['./provider-form.component.scss'],
})
export class ProviderFormComponent {
  private readonly dialogRef = inject<
    MatDialogRef<ProviderFormComponent, boolean>
  >(MatDialogRef<ProviderFormComponent, boolean>);
  private readonly data = inject<ProviderFormData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly providerService = inject(ProviderService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly form: FormGroup;
  protected readonly isEdit: boolean;

  constructor() {
    const provider = this.data?.provider;
    this.isEdit = !!provider;

    this.form = this.fb.group({
      name: [provider?.name ?? '', [Validators.required, Validators.maxLength(200)]],
      description: [provider?.description ?? ''],
      email: [provider?.email ?? '', [Validators.required, Validators.email]],
      phone: [provider?.phone ?? '', [Validators.required]],
      address: [provider?.address ?? ''],
      contactPerson: [provider?.contactPerson ?? ''],
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this._submitting) {
      return;
    }

    this._submitting = true;

    const formValue = {
      name: this.form.value.name?.trim(),
      description: this.form.value.description?.trim() || '',
      email: this.form.value.email?.trim(),
      phone: this.form.value.phone?.trim(),
      address: this.form.value.address?.trim() || null,
      contactPerson: this.form.value.contactPerson?.trim() || null,
    };

    const request$ = this.isEdit
      ? this.providerService.update(this.data!.provider!.id, formValue)
      : this.providerService.create(formValue);

    request$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEdit
            ? 'Proveedor actualizado correctamente'
            : 'Proveedor creado correctamente',
          'Cerrar',
          { duration: 3000 }
        );
        this.dialogRef.close(true);
      },
      error: () => {
        this._submitting = false;
        this.snackBar.open('Error al guardar el proveedor', 'Cerrar', {
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
