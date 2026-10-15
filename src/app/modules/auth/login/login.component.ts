import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService, SUPER_ADMIN_ONLY_MESSAGE } from '../../../core/services/auth.service';

/** Misma regla que el backend (admin_users): 10+ caracteres con mayuscula, minuscula y numero. */
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="login-wrapper">
      <div class="login-container">
        <div class="login-brand">
          <img class="brand-logo" src="logo-white.png" alt="FacilisTap" />
          <h1>FacilisTap</h1>
          <p>Panel Administrativo</p>
        </div>

        <mat-card class="login-card">
          <mat-card-content>
            @if (step() === 'login') {
              <h2 class="login-title">Iniciar Sesión</h2>
              <p class="login-subtitle">Cuenta del panel administrativo (no es la cuenta de la app)</p>

              <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Email</mat-label>
                  <mat-icon matPrefix>mail</mat-icon>
                  <input matInput type="email" formControlName="email" autocomplete="username" />
                  @if (loginForm.get('email')?.hasError('email')) {
                    <mat-error>Email inválido</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Contraseña</mat-label>
                  <mat-icon matPrefix>lock</mat-icon>
                  <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password" autocomplete="current-password" />
                  <button mat-icon-button matSuffix type="button" (click)="hidePassword.set(!hidePassword())" aria-label="Mostrar contraseña">
                    <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>

                <button mat-flat-button color="primary" type="submit" class="full-width login-btn" [disabled]="loginForm.invalid || loading()">
                  @if (loading()) {
                    <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                  }
                  <span>Iniciar Sesión</span>
                </button>
              </form>
            } @else {
              <!-- Cuenta nueva o clave restablecida: debe poner una propia antes de entrar. -->
              <h2 class="login-title">Cree su contraseña</h2>
              <p class="login-subtitle">Por seguridad, cambie la contraseña temporal antes de entrar al panel.</p>

              <form [formGroup]="passwordForm" (ngSubmit)="onChangePassword()">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Nueva contraseña</mat-label>
                  <mat-icon matPrefix>lock_reset</mat-icon>
                  <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
                  <mat-hint>Mínimo 10 caracteres, con mayúscula, minúscula y número</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Repita la contraseña</mat-label>
                  <mat-icon matPrefix>lock</mat-icon>
                  <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
                  @if (passwordForm.hasError('mismatch') && passwordForm.get('confirm')?.touched) {
                    <mat-error>No coincide</mat-error>
                  }
                </mat-form-field>
                <button mat-flat-button color="primary" type="submit" class="full-width login-btn" [disabled]="passwordForm.invalid || loading()">
                  @if (loading()) {
                    <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                  }
                  <span>Guardar y entrar</span>
                </button>
              </form>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .login-wrapper {
        min-height: 100vh; display: flex; align-items: center; justify-content: center;
        /* Mismo degradado de la app Facilista (--app-gradient-start/end). */
        background: var(--fac-gradient); padding: 24px;
      }
      .login-container { width: 100%; max-width: 420px; }
      .login-brand {
        text-align: center; margin-bottom: 32px;
        .brand-logo { width: 96px; height: 96px; object-fit: contain; margin-bottom: 4px; }
        h1 { font-size: 28px; font-weight: 700; color: #ffffff; margin: 0 0 4px; }
        p { font-size: 14px; color: rgba(255, 255, 255, 0.85); margin: 0; }
      }
      .login-card {
        border-radius: 20px !important; box-shadow: 0 22px 48px rgba(15, 23, 42, 0.28);
        mat-card-content { padding: 32px; }
      }
      .login-title { font-size: 22px; font-weight: 700; color: var(--fac-text); margin: 0 0 4px; text-align: center; }
      .login-subtitle { font-size: 14px; color: var(--fac-text-muted); margin: 0 0 28px; text-align: center; }
      .full-width { width: 100%; margin-bottom: 16px; }
      .login-btn {
        height: 48px; font-size: 16px; font-weight: 600; margin-top: 8px; border-radius: var(--fac-radius);
        display: flex; align-items: center; justify-content: center; gap: 8px;
      }
      .btn-spinner { display: inline-block; }
    `,
  ],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly hidePassword = signal(true);
  protected readonly loading = signal(false);
  protected readonly step = signal<'login' | 'password'>('login');
  /** Contraseña escrita en el login: es la "actual" al pedir el cambio. */
  private typedPassword = '';

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly passwordForm = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
      confirm: ['', [Validators.required]],
    },
    {
      validators: (group: AbstractControl): ValidationErrors | null =>
        group.get('newPassword')?.value === group.get('confirm')?.value ? null : { mismatch: true },
    },
  );

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('denied')) {
      this.snackBar.open(SUPER_ADMIN_ONLY_MESSAGE, 'Cerrar', { duration: 6000, panelClass: 'error-snackbar' });
    }
    if (this.route.snapshot.queryParamMap.get('ip')) {
      this.snackBar.open('Acceso no autorizado. Comuníquese con el administrador.', 'Cerrar', { duration: 8000, panelClass: 'error-snackbar' });
    }
    if (this.route.snapshot.queryParamMap.get('expired')) {
      this.snackBar.open('Su sesión expiró. Inicie sesión de nuevo.', 'Cerrar', { duration: 6000 });
    }
    // Sesion abierta que aun debe cambiar la contraseña.
    if (this.authService.isAuthenticated() && this.authService.mustChangePassword()) {
      this.step.set('password');
    }
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    const { email, password } = this.loginForm.getRawValue();
    this.typedPassword = password ?? '';

    this.authService.login({ email: email ?? '', password: password ?? '' }).subscribe({
      next: (data) => {
        this.loading.set(false);
        if (data.admin.mustChangePassword) {
          this.step.set('password');
          return;
        }
        this.enterPanel();
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.snackBar.open(err?.message || 'Email o contraseña incorrectos.', 'Cerrar', {
          duration: 5000,
          panelClass: 'error-snackbar',
        });
      },
    });
  }

  protected onChangePassword(): void {
    if (this.passwordForm.invalid) return;
    this.loading.set(true);
    this.authService.changePassword(this.typedPassword, this.passwordForm.value.newPassword!).subscribe({
      next: () => {
        this.loading.set(false);
        this.snackBar.open('Contraseña actualizada', 'Cerrar', { duration: 3000 });
        this.enterPanel();
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.snackBar.open(err?.message || 'No se pudo cambiar la contraseña', 'Cerrar', { duration: 5000 });
        // Sin la contraseña actual (p. ej. recargo la pagina) hay que volver a iniciar sesion.
        if (!this.typedPassword) {
          this.authService.logout().subscribe();
          this.step.set('login');
        }
      },
    });
  }

  private enterPanel(): void {
    if (!this.authService.hasPanelAccess()) {
      this.snackBar.open(SUPER_ADMIN_ONLY_MESSAGE, 'Cerrar', { duration: 6000, panelClass: 'error-snackbar' });
      this.authService.logout().subscribe();
      this.step.set('login');
      return;
    }
    void this.router.navigate(['/admin/dashboard']);
  }
}
