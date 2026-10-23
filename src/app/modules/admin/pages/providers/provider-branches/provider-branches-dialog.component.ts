import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { ProviderService } from '../../../services/provider.service';
import { Provider, ProviderBranch } from '../../../../../core/models/provider.interface';
import { ConfirmDialogService } from '../../../../../shared/services/confirm-dialog.service';

/** Sedes de un proveedor: el panel las bloquea (con motivo) o las desbloquea. */
@Component({
  selector: 'app-provider-branches-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './provider-branches-dialog.component.html',
  styleUrls: ['./provider-branches-dialog.component.scss'],
})
export class ProviderBranchesDialogComponent implements OnInit {
  private readonly providerService = inject(ProviderService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<ProviderBranchesDialogComponent>);
  protected readonly data = inject<{ provider: Provider }>(MAT_DIALOG_DATA);

  protected readonly branches = signal<ProviderBranch[]>([]);
  protected readonly loading = signal(true);
  /** Sede a la que se le está escribiendo el motivo de bloqueo. */
  protected readonly blockingId = signal<number | null>(null);
  protected readonly savingId = signal<number | null>(null);
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5), Validators.maxLength(300)],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.providerService
      .getBranches(this.data.provider.id)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.branches.set(rows),
        error: () => this.snackBar.open('No se pudieron cargar las sedes', 'Cerrar', { duration: 5000 }),
      });
  }

  protected startBlock(branch: ProviderBranch): void {
    this.reason.reset('');
    this.blockingId.set(branch.id);
  }

  protected cancelBlock(): void {
    this.blockingId.set(null);
  }

  protected confirmBlock(branch: ProviderBranch): void {
    if (this.reason.value.trim().length < 5) {
      this.reason.markAsTouched();
      this.reason.setErrors({ minlength: true });
      return;
    }
    this.save(branch, true, this.reason.value.trim());
  }

  protected unblock(branch: ProviderBranch): void {
    this.confirmDialog
      .confirm({
        title: 'Desbloquear sede',
        message: `${branch.name} volverá a estar activa: los clientes la verán y podrán agendar ahí.`,
        confirmText: 'Desbloquear',
        icon: 'lock_open',
        color: '#0078ff',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.save(branch, false));
  }

  private save(branch: ProviderBranch, blocked: boolean, reason?: string): void {
    this.savingId.set(branch.id);
    this.providerService
      .setBranchBlocked(this.data.provider.id, branch.id, blocked, reason)
      .pipe(finalize(() => this.savingId.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.branches.update((rows) => rows.map((b) => (b.id === updated.id ? updated : b)));
          this.blockingId.set(null);
          this.snackBar.open(blocked ? 'Sede bloqueada' : 'Sede desbloqueada', 'Cerrar', { duration: 3000 });
        },
        error: (err: any) =>
          this.snackBar.open(err?.error?.message || err?.message || 'No se pudo cambiar la sede', 'Cerrar', { duration: 5000 }),
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
