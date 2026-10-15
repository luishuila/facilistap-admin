import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';

import { SubscriptionService } from '../../services/subscription.service';
import { UserService } from '../../services/user.service';
import { User } from '../../../../core/models/user.interface';
import { CYCLE_LABELS, SubscriptionCycle } from '../../../../core/models/subscription.interface';

export interface SubscriptionGrantData {
  /** Usuario ya elegido (extender desde la tabla); si no viene se busca. */
  user?: { id: string; name: string; email?: string | null };
  endAt?: string | null;
  /** Estado actual: solo una ACTIVA no vencida extiende desde su fecha de fin. */
  status?: string | null;
}

@Component({
  selector: 'app-subscription-grant',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="grant-dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>workspace_premium</mat-icon></div>
        <div>
          <h2 class="dialog-title">{{ data.user ? 'Agregar días a la suscripción' : 'Activar suscripción' }}</h2>
          <p class="dialog-subtitle">
            Los días se suman desde el fin vigente; si ya venció, desde hoy. Se reactivan los empleados del negocio.
          </p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="dialog-body">
        @if (data.user) {
          <div class="selected-user">
            <mat-icon>person</mat-icon>
            <div>
              <strong>{{ data.user.name }}</strong>
              <span>{{ data.user.email }}</span>
              @if (data.endAt) {
                <span>Vence: {{ data.endAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              }
            </div>
          </div>
        } @else {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Usuario</mat-label>
            <input
              matInput
              [formControl]="userSearch"
              [matAutocomplete]="auto"
              placeholder="Buscar por nombre, usuario o email"
              autocomplete="off"
            />
            <mat-icon matPrefix>search</mat-icon>
            <mat-autocomplete #auto="matAutocomplete" [displayWith]="displayUser" (optionSelected)="selectUser($event.option.value)">
              @for (u of userOptions(); track u.id) {
                <mat-option [value]="u">
                  {{ u.name }} {{ u.lastname }} <small class="muted">· {{ u.email }}</small>
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        }

        <div class="quick-days">
          <span class="quick-label">Agregar rápido:</span>
          @for (d of quickDays; track d) {
            <button
              mat-stroked-button
              type="button"
              class="day-chip"
              [class.selected]="form.value.days === d"
              (click)="setDays(d)"
            >
              +{{ d }} días
            </button>
          }
        </div>

        <div class="two-cols">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Ciclo</mat-label>
            <mat-select formControlName="billingCycle">
              @for (c of cycles; track c.value) {
                <mat-option [value]="c.value">{{ c.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Días exactos (opcional)</mat-label>
            <input matInput type="number" min="1" max="3650" formControlName="days" placeholder="Usa los del ciclo" />
          </mat-form-field>
        </div>

        <div class="preview">
          <mat-icon>event_available</mat-icon>
          @if (form.value.days) {
            <span>
              Nueva fecha de vencimiento: <strong>{{ previewEndAt() | date: 'dd/MM/yyyy' }}</strong>
              ({{ form.value.days }} días desde {{ extendsFromEnd() ? 'el vencimiento actual' : 'hoy' }})
            </span>
          } @else {
            <span>
              Se suman los días del ciclo <strong>{{ cycleLabel() }}</strong> desde
              {{ extendsFromEnd() ? 'el vencimiento actual' : 'hoy' }}. Para un número exacto use los botones o "Días exactos".
            </span>
          }
        </div>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Valor cobrado (0 = cortesía)</mat-label>
          <input matInput type="number" min="0" formControlName="amount" />
          <span matTextPrefix>$&nbsp;</span>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Nota (opcional)</mat-label>
          <textarea matInput rows="2" maxlength="300" formControlName="note" placeholder="Ej: pago en efectivo, compensación..."></textarea>
        </mat-form-field>

        <div class="dialog-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(false)" [disabled]="submitting()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
            @if (submitting()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>check</mat-icon>
            }
            <span>{{ data.user ? 'Agregar días' : 'Activar' }}</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .grant-dialog { padding: 8px; max-width: 520px; }
      .dialog-header { display: flex; gap: 16px; padding: 8px 8px 16px; align-items: flex-start; }
      .header-icon {
        width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        display: flex; align-items: center; justify-content: center;
        mat-icon { color: #fff; }
      }
      .dialog-title { margin: 0; font-size: 20px; font-weight: 600; color: #1e293b; }
      .dialog-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748b; }
      .dialog-body { display: flex; flex-direction: column; gap: 12px; padding: 0 8px; }
      .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .selected-user {
        display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 8px; background: #f8fafc;
        div { display: flex; flex-direction: column; font-size: 13px; color: #64748b; }
        strong { color: #1e293b; font-size: 14px; }
      }
      .muted { color: #94a3b8; }
      .quick-days { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .quick-label { font-size: 13px; color: var(--fac-text-muted); }
      .day-chip { border-radius: 18px !important; height: 34px; padding: 0 14px; }
      .day-chip.selected { background: var(--fac-primary-soft); border-color: var(--fac-primary); color: var(--fac-primary-deep); }
      .preview {
        display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px;
        background: var(--fac-primary-soft); color: #33556b; font-size: 13px; line-height: 1.45;
        mat-icon { color: var(--fac-primary-shade); flex-shrink: 0; }
      }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding: 8px 0 4px;
        button { border-radius: 8px; height: 44px; padding: 0 24px; display: inline-flex; align-items: center; gap: 8px; }
      }
      @media (max-width: 520px) { .two-cols { grid-template-columns: 1fr; } }
    `,
  ],
})
export class SubscriptionGrantComponent implements OnInit {
  protected readonly data: SubscriptionGrantData = inject(MAT_DIALOG_DATA) ?? {};
  protected readonly dialogRef = inject(MatDialogRef<SubscriptionGrantComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly userService = inject(UserService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cycles = (Object.keys(CYCLE_LABELS) as SubscriptionCycle[]).map((value) => ({
    value,
    label: CYCLE_LABELS[value],
  }));
  protected readonly quickDays = [7, 15, 30, 90];
  /** Vencimiento y estado actuales del usuario elegido (para la vista previa). */
  private readonly currentEndAt = signal<string | null>(this.data.endAt ?? null);
  private readonly currentStatus = signal<string | null>(this.data.status ?? null);
  protected readonly userOptions = signal<User[]>([]);
  protected readonly submitting = signal(false);
  protected readonly userSearch = this.fb.control<string | User>('');

  protected readonly form = this.fb.group({
    userId: [this.data.user?.id ?? '', Validators.required],
    billingCycle: ['MONTHLY' as SubscriptionCycle, Validators.required],
    days: [null as number | null, [Validators.min(1), Validators.max(3650)]],
    amount: [0, [Validators.required, Validators.min(0)]],
    note: [''],
  });

  ngOnInit(): void {
    this.userSearch.valueChanges
      .pipe(
        filter((v): v is string => typeof v === 'string'),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          this.form.patchValue({ userId: '' });
          return this.userService.getAll({ page: 1, limit: 10, search: term.trim() || undefined });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (res) => this.userOptions.set(res.items ?? []) });
  }

  protected setDays(days: number): void {
    this.form.patchValue({ days });
  }

  /** Igual que el backend: una suscripcion ACTIVA que no ha vencido se extiende desde su fin; si no, desde hoy. */
  protected extendsFromEnd(): boolean {
    const endAt = this.currentEndAt();
    const end = endAt ? new Date(endAt).getTime() : 0;
    return this.currentStatus() === 'ACTIVE' && end > Date.now();
  }

  protected previewEndAt(): Date {
    const base = this.extendsFromEnd() ? new Date(this.currentEndAt()!).getTime() : Date.now();
    return new Date(base + Number(this.form.value.days || 0) * 86_400_000);
  }

  protected cycleLabel(): string {
    return CYCLE_LABELS[(this.form.value.billingCycle ?? 'MONTHLY') as SubscriptionCycle];
  }

  protected displayUser(u: User | string | null): string {
    if (!u || typeof u === 'string') return u ?? '';
    return `${u.name ?? ''} ${u.lastname ?? ''}`.trim() || u.email || '';
  }

  protected selectUser(u: User): void {
    this.form.patchValue({ userId: u.id });
    this.currentEndAt.set(null);
    this.currentStatus.set(null);
    this.subscriptionService
      .getUserBilling(u.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.currentEndAt.set(res.data?.subscription?.endAt ?? null);
          this.currentStatus.set(res.data?.subscription?.status ?? null);
        },
      });
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.subscriptionService
      .activate({
        userId: v.userId!,
        billingCycle: v.billingCycle!,
        days: v.days ? Number(v.days) : undefined,
        amount: Number(v.amount ?? 0),
        note: v.note?.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Suscripción activada correctamente', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.snackBar.open('No se pudo activar la suscripción', 'Cerrar', { duration: 5000 });
          this.submitting.set(false);
        },
      });
  }
}
