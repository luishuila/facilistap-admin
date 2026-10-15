import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { Observable, finalize } from 'rxjs';

import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AllowedIp, AllowedIpOverview, AllowedIpScope, AllowedIpService } from '../../services/allowed-ip.service';
import { StaffMember, StaffService } from '../../services/staff.service';

/** IP (v4/v6) o rango CIDR; el backend hace la validacion completa. */
const IP_OR_CIDR = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

@Component({
  selector: 'app-allowed-ip-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">IPs permitidas</h1>
          <p class="page-subtitle">
            Asigne IPs públicas a un grupo o a una persona. Con la protección activa, cada administrativo solo entra desde
            una IP de su grupo o propia; si no tiene ninguna, o entra desde otra red, verá <strong>"Acceso no autorizado"</strong>
            y el panel lo saca (en menos de un minuto si ya estaba dentro).
          </p>
        </div>
      </div>

      @if (data(); as d) {
        <div class="status" [class.on]="d.enabled" [class.off]="!d.enabled">
          <mat-icon>{{ d.enabled ? 'verified_user' : 'gpp_maybe' }}</mat-icon>
          <div class="status-text">
            @if (d.emergencyOff) {
              <strong>Lista apagada desde el servidor</strong>
              <span>ADMIN_IP_ALLOWLIST_DISABLED=true en el .env: se entra desde cualquier IP.</span>
            } @else if (d.enabled) {
              <strong>Protección activa</strong>
              <span>Solo entra quien tenga una IP asignada (de su grupo o propia) y esté en esa red.</span>
            } @else {
              <strong>Sin restricciones</strong>
              <span>No hay IPs activas: todos entran desde cualquier red. Al activar la primera, quien no tenga IP ya no entra.</span>
            }
          </div>
          <div class="my-ip">
            <span class="label">Su IP detectada</span>
            <code>{{ d.currentIp || 'desconocida' }}</code>
            @if (!hasMine(d)) {
              <button mat-stroked-button type="button" (click)="addMine(d.currentIp)" [disabled]="saving() || !d.currentIp">
                <mat-icon>add</mat-icon> Asignarme mi IP actual
              </button>
            }
          </div>
        </div>

        @if (d.withoutAccess.length) {
          <div class="warn-box">
            <mat-icon>block</mat-icon>
            <div>
              <strong>Sin IP asignada: no pueden entrar al panel</strong>
              <span>
                @for (a of d.withoutAccess; track a.id; let last = $last) {
                  {{ a.name }} ({{ a.email }}){{ last ? '' : ', ' }}
                }
              </span>
            </div>
          </div>
        }
      }

      <form class="add-form" [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>IP o rango</mat-label>
          <input matInput formControlName="address" placeholder="190.85.10.4 o 190.85.10.0/24" autocomplete="off" />
          @if (form.get('address')?.hasError('pattern')) {
            <mat-error>IP inválida</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="who">
          <mat-label>Aplica a</mat-label>
          <mat-select formControlName="target">
            <mat-optgroup label="Grupos">
              <mat-option value="ALL">Todos los administrativos</mat-option>
              <mat-option value="SUPER_ADMINS">Solo Super Admins</mat-option>
              <mat-option value="STAFF">Solo administrativos (no Super Admin)</mat-option>
            </mat-optgroup>
            <mat-optgroup label="Una persona">
              @for (s of staff(); track s.id) {
                <mat-option [value]="'USER:' + s.id">{{ s.name }} {{ s.lastname || '' }} · {{ s.email }}</mat-option>
              }
            </mat-optgroup>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
          <mat-label>Descripción</mat-label>
          <input matInput formControlName="label" placeholder="Oficina principal" autocomplete="off" />
        </mat-form-field>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
          @if (saving()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>{{ editingId() ? 'save' : 'add' }}</mat-icon>
          }
          {{ editingId() ? 'Guardar' : 'Agregar IP' }}
        </button>
        @if (editingId()) {
          <button mat-stroked-button type="button" (click)="cancelEdit()">Cancelar</button>
        }
      </form>

      <div class="table-card">
        @if (loading()) {
          <div class="empty"><mat-spinner diameter="32"></mat-spinner></div>
        } @else if (!data()?.items?.length) {
          <div class="empty">
            <mat-icon>public</mat-icon>
            <span>Sin IPs registradas. El panel está abierto desde cualquier red.</span>
          </div>
        } @else {
          <table>
            <thead>
              <tr>
                <th>IP / rango</th>
                <th>Aplica a</th>
                <th>Descripción</th>
                <th>Activa</th>
                <th>Creada</th>
                <th class="right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (ip of data()!.items; track ip.id) {
                <tr [class.inactive]="!ip.isActive">
                  <td>
                    <code>{{ ip.address }}</code>
                    @if (ip.matchesCurrent) {
                      <span class="chip" matTooltip="Su conexión actual entra por esta regla">su IP</span>
                    }
                  </td>
                  <td>
                    @if (ip.scope === 'USER') {
                      <span class="who-cell"><strong>{{ ip.adminUserName }}</strong><small>{{ ip.adminUserEmail }}</small></span>
                    } @else {
                      <span class="chip all"><mat-icon>groups</mat-icon>{{ ip.scopeLabel }}</span>
                    }
                  </td>
                  <td>{{ ip.label || '—' }}</td>
                  <td>
                    <mat-slide-toggle color="primary" [checked]="ip.isActive" [disabled]="saving()" (change)="toggle(ip, $event.checked)" />
                  </td>
                  <td>{{ ip.createdAt | date: 'short' }}</td>
                  <td class="right">
                    <button mat-icon-button type="button" matTooltip="Editar" (click)="edit(ip)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button type="button" matTooltip="Eliminar" class="danger" (click)="remove(ip)"><mat-icon>delete</mat-icon></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <p class="note">
        <mat-icon>info</mat-icon>
        Si su proveedor de internet cambia la IP pública, registre la nueva o use un rango.
        El sistema no deja guardar un cambio que lo deje a usted sin acceso.
      </p>
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 760px; }
      .status {
        display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 18px; border-radius: 14px;
        border: 1px solid var(--fac-border);
        > mat-icon { font-size: 30px; width: 30px; height: 30px; }
        &.on { background: #ecfdf5; border-color: #a7f3d0; > mat-icon { color: #16a34a; } }
        &.off { background: #fffbeb; border-color: #fde68a; > mat-icon { color: #d97706; } }
      }
      .status-text { display: flex; flex-direction: column; flex: 1; min-width: 220px; font-size: 13px; color: var(--fac-text-muted);
        strong { font-size: 15px; color: var(--fac-text); } }
      .my-ip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        .label { font-size: 12px; color: var(--fac-text-muted); }
        button { border-radius: 10px; } }
      code { background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-size: 13px; }
      .add-form { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
        mat-form-field { min-width: 200px; } .grow { flex: 1; } .who { min-width: 260px; }
        button { border-radius: 10px; height: 48px; display: inline-flex; align-items: center; gap: 6px; } }
      .table-card { background: var(--fac-surface, #fff); border: 1px solid var(--fac-border); border-radius: 14px; overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th { text-align: left; font-weight: 600; color: var(--fac-text-muted); font-size: 12px; text-transform: uppercase; padding: 12px 16px; border-bottom: 1px solid var(--fac-border); }
      td { padding: 8px 16px; border-bottom: 1px solid var(--fac-border); color: var(--fac-text); }
      tr:last-child td { border-bottom: none; }
      tr.inactive td { opacity: 0.55; }
      .right { text-align: right; white-space: nowrap; }
      .who-cell { display: flex; flex-direction: column; strong { font-weight: 600; } small { font-size: 12px; color: var(--fac-text-muted); } }
      .chip.all { margin-left: 0; color: #475569; background: #e2e8f0; display: inline-flex; align-items: center; gap: 4px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      .warn-box { display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; border-radius: 14px;
        background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; font-size: 13px;
        mat-icon { color: #dc2626; }
        div { display: flex; flex-direction: column; gap: 2px; }
        strong { font-size: 14px; } }
      .chip { margin-left: 8px; font-size: 11px; font-weight: 600; color: #0078ff; background: #e0efff; padding: 2px 8px; border-radius: 999px; }
      .danger mat-icon { color: #ef4444; }
      .empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 36px; color: var(--fac-text-muted); }
      .note { display: flex; gap: 8px; align-items: flex-start; margin: 0; font-size: 13px; color: var(--fac-text-muted);
        mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      @media (max-width: 600px) { .list-page { padding: 16px; } .add-form button { width: 100%; justify-content: center; } }
    `,
  ],
})
export class AllowedIpListComponent implements OnInit {
  private readonly service = inject(AllowedIpService);
  private readonly staffService = inject(StaffService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = signal<AllowedIpOverview | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly staff = signal<StaffMember[]>([]);
  private readonly selfId = inject(AuthService).getCurrentUser()?.id ?? null;

  protected readonly form = this.fb.group({
    address: ['', [Validators.required, Validators.maxLength(64), Validators.pattern(IP_OR_CIDR)]],
    label: ['', [Validators.maxLength(120)]],
    /** 'ALL' | 'SUPER_ADMINS' | 'STAFF' | 'USER:<id>' */
    target: ['ALL' as string],
  });

  ngOnInit(): void {
    this.load();
    this.staffService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.staff.set(list.filter((s) => s.isActive)) });
  }

  private load(): void {
    this.loading.set(!this.data());
    this.service
      .overview()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (d) => this.data.set(d),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar las IPs', 'Cerrar', { duration: 5000 }),
      });
  }

  /** Su IP actual ya le esta permitida (para su usuario o su grupo). */
  protected hasMine(d: AllowedIpOverview): boolean {
    return d.items.some((i) => i.isActive && i.matchesCurrent && i.scope !== 'STAFF' && (i.scope !== 'USER' || i.adminUserId === this.selfId));
  }

  protected addMine(ip: string): void {
    this.run(
      this.service.create({ address: ip, label: 'Agregada desde el panel', scope: 'USER', adminUserId: this.selfId }),
      'Su IP quedó asignada a su usuario',
    );
  }

  private toTarget(ip: AllowedIp): string {
    return ip.scope === 'USER' ? `USER:${ip.adminUserId}` : ip.scope;
  }

  private fromTarget(target: string | null | undefined): { scope: AllowedIpScope; adminUserId: string | null } {
    if (target?.startsWith('USER:')) return { scope: 'USER', adminUserId: target.slice(5) };
    return { scope: (target as AllowedIpScope) || 'ALL', adminUserId: null };
  }

  protected submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body = {
      address: v.address!.trim(),
      label: v.label?.trim() || undefined,
      ...this.fromTarget(v.target),
    };
    const id = this.editingId();
    this.run(id ? this.service.update(id, body) : this.service.create(body), id ? 'IP actualizada' : 'IP agregada', () => this.cancelEdit());
  }

  protected edit(ip: AllowedIp): void {
    this.editingId.set(ip.id);
    this.form.setValue({ address: ip.address, label: ip.label ?? '', target: this.toTarget(ip) });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ address: '', label: '', target: 'ALL' });
  }

  protected toggle(ip: AllowedIp, active: boolean): void {
    this.run(this.service.update(ip.id, { isActive: active }), active ? 'IP activada' : 'IP desactivada');
  }

  protected remove(ip: AllowedIp): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar IP',
        message: `Se quitará ${ip.address}${ip.label ? ` (${ip.label})` : ''} de ${ip.adminUserName ?? ip.scopeLabel}. Quien dependa de ella dejará de poder entrar.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.run(this.service.remove(ip.id), 'IP eliminada'));
  }

  private run(request$: Observable<unknown>, done: string, after?: () => void): void {
    this.saving.set(true);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(done, 'Cerrar', { duration: 3000 });
          after?.();
          this.load();
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo guardar', 'Cerrar', { duration: 7000 });
          // El toggle ya se movio en pantalla: recargar para que muestre el estado real.
          this.load();
        },
      });
  }
}
