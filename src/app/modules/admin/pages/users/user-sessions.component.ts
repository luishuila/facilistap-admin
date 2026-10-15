import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { AppUserSession, UserService } from '../../services/user.service';
import { User } from '../../../../core/models/user.interface';

/** Dispositivos con sesion abierta de un usuario de la app; se pueden cerrar uno a uno o todos. */
@Component({
  selector: 'app-user-sessions',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, MatSnackBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <div class="dialog-header">
        <div class="header-icon"><mat-icon>devices</mat-icon></div>
        <div>
          <h2>Sesiones en la app</h2>
          <p>{{ name }}{{ user.email ? ' · ' + user.email : '' }}</p>
        </div>
      </div>

      @if (loading()) {
        <div class="empty"><mat-spinner diameter="30"></mat-spinner></div>
      } @else if (!sessions().length) {
        <div class="empty">
          <mat-icon>phonelink_off</mat-icon>
          <span>No tiene sesiones abiertas en la app.</span>
        </div>
      } @else {
        <div class="list">
          @for (s of sessions(); track s.id) {
            <div class="session">
              <mat-icon class="device">{{ deviceIcon(s) }}</mat-icon>
              <div class="info">
                <strong>{{ deviceName(s) }}</strong>
                <small>
                  Inició {{ s.createdAt | date: 'short' }}
                  @if (s.ipAddress) {
                    · IP {{ s.ipAddress }}
                  }
                </small>
              </div>
              <button mat-stroked-button type="button" class="close-one" (click)="closeOne(s)" [disabled]="busy()" matTooltip="Cerrar este dispositivo">
                <mat-icon>logout</mat-icon> Cerrar
              </button>
            </div>
          }
        </div>
      }

      <p class="note">
        <mat-icon>info</mat-icon>
        Al cerrar, la app sale de inmediato en ese dispositivo y deberá volver a iniciar sesión. Para impedir que vuelva a entrar,
        bloquee el usuario.
      </p>

      <div class="actions">
        <button mat-stroked-button type="button" (click)="dialogRef.close(changed)">Cerrar ventana</button>
        <button mat-flat-button color="warn" type="button" (click)="closeAll()" [disabled]="busy() || !sessions().length">
          @if (busy()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>logout</mat-icon>
          }
          Cerrar todas ({{ sessions().length }})
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog { padding: 8px 16px; max-width: 600px; display: flex; flex-direction: column; gap: 14px; }
      .dialog-header { display: flex; gap: 14px; align-items: flex-start; padding-top: 4px;
        h2 { margin: 0; font-size: 20px; font-weight: 600; color: var(--fac-text); }
        p { margin: 4px 0 0; font-size: 13px; color: var(--fac-text-muted); } }
      .header-icon { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; background: var(--fac-gradient);
        display: flex; align-items: center; justify-content: center; mat-icon { color: #fff; } }
      .list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; }
      .session { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--fac-border); border-radius: 12px; }
      .device { color: var(--fac-primary-deep, #0078ff); }
      .info { display: flex; flex-direction: column; flex: 1; min-width: 0;
        strong { font-size: 14px; color: var(--fac-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        small { font-size: 12px; color: var(--fac-text-muted); } }
      .close-one { border-radius: 10px; color: #dc2626; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      .empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 28px; color: var(--fac-text-muted); }
      .note { display: flex; gap: 6px; align-items: flex-start; margin: 0; font-size: 12px; color: var(--fac-text-muted);
        mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; } }
      .actions { display: flex; justify-content: flex-end; gap: 12px; padding-bottom: 8px;
        button { border-radius: 10px; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 6px; } }
    `,
  ],
})
export class UserSessionsComponent implements OnInit {
  protected readonly user: User = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<UserSessionsComponent, boolean>);
  private readonly userService = inject(UserService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly name = `${this.user.name ?? ''} ${this.user.lastname ?? ''}`.trim() || this.user.username || 'Usuario';
  protected readonly sessions = signal<AppUserSession[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected changed = false;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.userService
      .sessions(this.user.id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => this.sessions.set(list),
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudieron cargar las sesiones', 'Cerrar', { duration: 5000 }),
      });
  }

  protected deviceName(s: AppUserSession): string {
    const d = s.deviceInfo ?? {};
    if (d['name']) return String(d['name']);
    const ua = String(d['userAgent'] ?? '');
    const os = /android/i.test(ua) ? 'Android' : /iphone|ipad|ios/i.test(ua) ? 'iPhone / iPad' : /windows/i.test(ua) ? 'Windows'
      : /mac os/i.test(ua) ? 'Mac' : /linux/i.test(ua) ? 'Linux' : String(d['platform'] ?? '');
    const app = /capacitor|ionic|wv\)/i.test(ua) ? 'App' : ua ? 'Navegador' : '';
    return [app, os].filter(Boolean).join(' · ') || 'Dispositivo desconocido';
  }

  protected deviceIcon(s: AppUserSession): string {
    const ua = String(s.deviceInfo?.['userAgent'] ?? '') + String(s.deviceInfo?.['name'] ?? '');
    return /android|iphone|ipad|mobile/i.test(ua) ? 'smartphone' : 'computer';
  }

  protected closeOne(s: AppUserSession): void {
    this.busy.set(true);
    this.userService
      .closeSession(this.user.id, s.id)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.changed = true;
          this.sessions.update((list) => list.filter((x) => x.id !== s.id));
          this.snackBar.open('Sesión cerrada en ese dispositivo', 'Cerrar', { duration: 3000 });
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo cerrar la sesión', 'Cerrar', { duration: 5000 }),
      });
  }

  protected closeAll(): void {
    this.busy.set(true);
    this.userService
      .closeAllSessions(this.user.id)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.changed = true;
          this.sessions.set([]);
          this.snackBar.open(`${this.name} salió de la app en todos sus dispositivos`, 'Cerrar', { duration: 4000 });
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudieron cerrar las sesiones', 'Cerrar', { duration: 5000 }),
      });
  }
}
