import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, filter, finalize, merge, switchMap } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { BroadcastService } from '../../services/broadcast.service';
import { RoleService } from '../../services/role.service';
import { UserService } from '../../services/user.service';
import { AUDIENCE_LABELS, Broadcast, BroadcastAudience } from '../../../../core/models/broadcast.interface';
import { User } from '../../../../core/models/user.interface';
import { Role } from '../../../../core/models/role.interface';
import { PageEvent, TableColumn } from '../../../../shared/components/data-table/data-table.types';

type BroadcastRow = Broadcast & { audienceLabel: string };

const MAX_IMAGE_MB = 5;

@Component({
  selector: 'app-notification-broadcast',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    DataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">Notificaciones</h1>
        <p class="page-subtitle">Envíe un aviso con texto e imagen a los usuarios de la app. Llega a su bandeja de Notificaciones y como push al teléfono.</p>
      </div>

      <div class="compose-grid">
        <form class="card compose" [formGroup]="form" (ngSubmit)="confirmSend()">
          <h3 class="card-title"><mat-icon>campaign</mat-icon> Nuevo aviso</h3>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Destinatarios</mat-label>
            <mat-select formControlName="audience">
              @for (a of audiences; track a.value) {
                <mat-option [value]="a.value">{{ a.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (form.value.audience === 'ROLE') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Rol</mat-label>
              <mat-select formControlName="role">
                @for (r of roles(); track r.id) {
                  <mat-option [value]="r.role">{{ r.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }

          @if (form.value.audience === 'USERS') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Usuarios</mat-label>
              <mat-chip-grid #chipGrid>
                @for (u of selectedUsers(); track u.id) {
                  <mat-chip-row (removed)="removeUser(u)">
                    {{ u.name }} {{ u.lastname }}
                    <button matChipRemove type="button"><mat-icon>cancel</mat-icon></button>
                  </mat-chip-row>
                }
                <input
                  placeholder="Buscar por nombre o email"
                  [formControl]="userSearch"
                  [matAutocomplete]="userAuto"
                  [matChipInputFor]="chipGrid"
                />
              </mat-chip-grid>
              <mat-autocomplete #userAuto="matAutocomplete" (optionSelected)="addUser($event.option.value)">
                @for (u of userOptions(); track u.id) {
                  <mat-option [value]="u">{{ u.name }} {{ u.lastname }} <small class="muted">· {{ u.email }}</small></mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          }

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Título</mat-label>
            <input matInput formControlName="title" maxlength="150" placeholder="Ej: ¡Nueva función disponible!" />
            <mat-hint align="end">{{ form.value.title?.length || 0 }}/150</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Mensaje</mat-label>
            <textarea matInput formControlName="message" rows="4" maxlength="1000" placeholder="Escriba el mensaje para los usuarios..."></textarea>
            <mat-hint align="end">{{ form.value.message?.length || 0 }}/1000</mat-hint>
          </mat-form-field>

          <div class="image-row">
            @if (imageUrl()) {
              <div class="image-preview">
                <img [src]="imageUrl()" alt="Imagen del aviso" />
                <button mat-icon-button type="button" class="remove-img" (click)="imageUrl.set(null)" title="Quitar imagen">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            } @else {
              <button mat-stroked-button type="button" [disabled]="uploading()" (click)="fileInput.click()">
                @if (uploading()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <mat-icon>add_photo_alternate</mat-icon>
                }
                <span>{{ uploading() ? 'Subiendo...' : 'Agregar imagen (opcional)' }}</span>
              </button>
              <span class="muted">JPG, PNG o WEBP · máx. {{ maxImageMb }} MB</span>
            }
            <input #fileInput type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="onFile($event); fileInput.value = ''" />
          </div>

          <div class="send-row">
            <span class="recipients">
              <mat-icon>group</mat-icon>
              @if (counting()) {
                Calculando…
              } @else {
                Llegará a <b>{{ recipients() | number }}</b> {{ recipients() === 1 ? 'usuario' : 'usuarios' }}
              }
            </span>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || sending() || uploading() || !recipients()">
              @if (sending()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>send</mat-icon>
              }
              Enviar aviso
            </button>
          </div>
        </form>

        <!-- Vista previa: como se ve en la bandeja de la app -->
        <div class="card preview">
          <h3 class="card-title"><mat-icon>smartphone</mat-icon> Vista previa en la app</h3>
          <div class="phone">
            <div class="notif">
              <span class="notif-avatar"><img src="logo-white.png" alt="" /></span>
              <div class="notif-body">
                <p class="notif-title">{{ form.value.title || 'Título del aviso' }}</p>
                <p class="notif-text">{{ form.value.message || 'Aquí va el mensaje para los usuarios.' }}</p>
                @if (imageUrl()) {
                  <img class="notif-image" [src]="imageUrl()" alt="" />
                }
                <span class="notif-time">ahora</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 class="section-title">Avisos enviados</h3>
      <app-data-table
        [columns]="columns"
        [data]="history()"
        [totalItems]="historyTotal()"
        [pageSize]="pageSize()"
        [loading]="historyLoading()"
        [showSearch]="false"
        [showExport]="false"
        [showAddButton]="false"
        [rowActions]="[]"
        (pageChange)="onPage($event)"
      />
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1400px; margin: 0 auto; }
      .page-header { margin-bottom: 20px; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); }
      .compose-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 20px; align-items: start; }
      .card { background: #fff; border-radius: 14px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); padding: 20px; }
      .card-title {
        display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 16px; font-weight: 600; color: var(--fac-text);
        mat-icon { color: var(--fac-primary-shade); }
      }
      .compose { display: flex; flex-direction: column; gap: 12px; }
      .compose mat-form-field { width: 100%; }
      .muted { color: #94a3b8; font-size: 12px; }
      .image-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .image-row button { border-radius: 10px; display: inline-flex; align-items: center; gap: 6px; }
      .image-preview { position: relative; }
      .image-preview img { max-width: 240px; max-height: 160px; border-radius: 10px; display: block; border: 1px solid var(--fac-border); }
      .remove-img { position: absolute; top: 4px; right: 4px; background: rgba(0, 0, 0, 0.55); color: #fff; width: 32px; height: 32px; padding: 4px; }
      .send-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
      .recipients {
        display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: #33556b;
        mat-icon { color: var(--fac-primary-shade); }
      }
      .send-row button { border-radius: 12px; height: 44px; padding: 0 22px; display: inline-flex; align-items: center; gap: 6px; }

      .phone { background: #f4f4f8; border-radius: 18px; padding: 14px; }
      .notif { display: flex; gap: 12px; padding: 12px; border-radius: 16px; background: #eef4ff; }
      .notif-avatar {
        width: 44px; height: 44px; border-radius: 50%; background: var(--fac-gradient); flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        img { width: 36px; height: 36px; object-fit: contain; }
      }
      .notif-body { flex: 1; min-width: 0; }
      .notif-title { margin: 0; font-weight: 700; font-size: 14px; color: #111827; }
      .notif-text { margin: 2px 0 0; font-size: 14px; color: #111827; white-space: pre-wrap; word-break: break-word; }
      .notif-image { margin-top: 8px; width: 100%; max-height: 180px; object-fit: cover; border-radius: 12px; }
      .notif-time { display: block; margin-top: 4px; font-size: 12px; font-weight: 600; color: #64748b; }
      .section-title { margin: 28px 0 12px; font-size: 18px; font-weight: 600; color: var(--fac-text); }
      @media (max-width: 900px) { .compose-grid { grid-template-columns: 1fr; } }
    `,
  ],
})
export class NotificationBroadcastComponent implements OnInit {
  private readonly broadcastService = inject(BroadcastService);
  private readonly roleService = inject(RoleService);
  private readonly userService = inject(UserService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxImageMb = MAX_IMAGE_MB;
  protected readonly audiences = (Object.keys(AUDIENCE_LABELS) as BroadcastAudience[]).map((value) => ({
    value,
    label: AUDIENCE_LABELS[value],
  }));

  protected readonly form = this.fb.group({
    audience: ['ALL' as BroadcastAudience, Validators.required],
    role: [null as string | null],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    message: ['', [Validators.required, Validators.maxLength(1000)]],
  });
  protected readonly userSearch = new FormControl<string | User>('');

  protected readonly roles = signal<Role[]>([]);
  protected readonly userOptions = signal<User[]>([]);
  protected readonly selectedUsers = signal<User[]>([]);
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly sending = signal(false);
  protected readonly recipients = signal(0);
  protected readonly counting = signal(false);

  protected readonly columns: TableColumn[] = [
    { key: 'createdAt', label: 'Fecha', type: 'date', format: 'dd/MM/yyyy HH:mm', width: '150px' },
    { key: 'imageUrl', label: 'Imagen', type: 'image', width: '80px', align: 'center' },
    { key: 'title', label: 'Título' },
    { key: 'message', label: 'Mensaje' },
    { key: 'audienceLabel', label: 'Destino', width: '170px' },
    { key: 'recipientsCount', label: 'Usuarios', type: 'number', width: '100px', align: 'center' },
    { key: 'createdByName', label: 'Enviado por', width: '160px' },
  ];
  protected readonly history = signal<BroadcastRow[]>([]);
  protected readonly historyTotal = signal(0);
  protected readonly historyLoading = signal(false);
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);

  ngOnInit(): void {
    this.roleService
      .getAll({ page: 1, limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.roles.set(res.items ?? []) });

    this.userSearch.valueChanges
      .pipe(
        filter((v): v is string => typeof v === 'string'),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.userService.getAll({ page: 1, limit: 10, search: term.trim() || undefined })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (res) => this.userOptions.set(res.items ?? []) });

    // Cuantos lo recibiran: se recalcula al cambiar el destino.
    merge(this.form.controls.audience.valueChanges, this.form.controls.role.valueChanges)
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateCount());

    this.updateCount();
    this.loadHistory();
  }

  protected addUser(user: User): void {
    if (!this.selectedUsers().some((u) => u.id === user.id)) {
      this.selectedUsers.update((list) => [...list, user]);
      this.updateCount();
    }
    this.userSearch.setValue('');
  }

  protected removeUser(user: User): void {
    this.selectedUsers.update((list) => list.filter((u) => u.id !== user.id));
    this.updateCount();
  }

  private updateCount(): void {
    const { audience, role } = this.form.getRawValue();
    if (audience === 'ROLE' && !role) return this.recipients.set(0);
    if (audience === 'USERS' && !this.selectedUsers().length) return this.recipients.set(0);
    this.counting.set(true);
    this.broadcastService
      .countRecipients(audience!, role ?? undefined, this.selectedUsers().map((u) => u.id))
      .pipe(
        finalize(() => this.counting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (n) => this.recipients.set(n), error: () => this.recipients.set(0) });
  }

  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.snackBar.open('Use una imagen JPG, PNG o WEBP', 'Cerrar', { duration: 4000 });
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      this.snackBar.open(`La imagen supera ${MAX_IMAGE_MB} MB`, 'Cerrar', { duration: 4000 });
      return;
    }
    this.uploading.set(true);
    this.broadcastService
      .uploadImage(file)
      .pipe(
        finalize(() => this.uploading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (url) => this.imageUrl.set(url),
        error: () => this.snackBar.open('No se pudo subir la imagen', 'Cerrar', { duration: 5000 }),
      });
  }

  protected confirmSend(): void {
    if (this.form.invalid || this.sending()) return;
    const count = this.recipients();
    this.confirmDialog
      .confirm({
        title: 'Enviar aviso',
        message: `Se enviará "${this.form.value.title}" a ${count} ${count === 1 ? 'usuario' : 'usuarios'} (bandeja de la app y push). No se puede deshacer.`,
        confirmText: 'Enviar',
        cancelText: 'Cancelar',
        icon: 'send',
        color: '#1daeff',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.send());
  }

  private send(): void {
    const v = this.form.getRawValue();
    this.sending.set(true);
    this.broadcastService
      .send({
        title: v.title!.trim(),
        message: v.message!.trim(),
        imageUrl: this.imageUrl() ?? undefined,
        audience: v.audience!,
        role: v.audience === 'ROLE' ? v.role ?? undefined : undefined,
        userIds: v.audience === 'USERS' ? this.selectedUsers().map((u) => u.id) : undefined,
      })
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.snackBar.open(`Aviso enviado a ${res.data?.recipientsCount ?? 0} usuarios`, 'Cerrar', { duration: 4000 });
          this.form.patchValue({ title: '', message: '' });
          this.form.markAsPristine();
          this.form.markAsUntouched();
          this.imageUrl.set(null);
          this.page.set(0);
          this.loadHistory();
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo enviar el aviso', 'Cerrar', { duration: 5000 }),
      });
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.loadHistory();
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.broadcastService
      .history({ page: this.page() + 1, limit: this.pageSize() })
      .pipe(
        finalize(() => this.historyLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.history.set(
            (res.items ?? []).map((b) => ({
              ...b,
              audienceLabel: b.audience === 'ROLE' ? `Rol: ${this.roleName(b.role)}` : AUDIENCE_LABELS[b.audience],
            })),
          );
          this.historyTotal.set(res.total ?? 0);
        },
      });
  }

  private roleName(code: string | null): string {
    return this.roles().find((r) => r.role === code)?.name ?? code ?? '';
  }
}
