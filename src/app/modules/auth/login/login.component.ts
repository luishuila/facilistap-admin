import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

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
          <mat-icon class="brand-icon">admin_panel_settings</mat-icon>
          <h1>FacilisTap</h1>
          <p>Panel Administrativo</p>
        </div>

        <mat-card class="login-card">
          <mat-card-content>
            <h2 class="login-title">Iniciar Sesión</h2>
            <p class="login-subtitle">
              Ingrese sus credenciales para acceder al sistema
            </p>

            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Usuario</mat-label>
                <mat-icon matPrefix>person</mat-icon>
                <input matInput formControlName="username" placeholder="Ingrese su usuario" autocomplete="username" />
                <mat-error *ngIf="loginForm.get('username')?.hasError('required')">
                  El usuario es requerido
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Contraseña</mat-label>
                <mat-icon matPrefix>lock</mat-icon>
                <input
                  matInput
                  [type]="hidePassword() ? 'password' : 'text'"
                  formControlName="password"
                  placeholder="Ingrese su contraseña"
                  autocomplete="current-password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="hidePassword.set(!hidePassword())"
                  [attr.aria-label]="'Mostrar contraseña'"
                >
                  <mat-icon>{{
                    hidePassword() ? 'visibility_off' : 'visibility'
                  }}</mat-icon>
                </button>
                <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
                  La contraseña es requerida
                </mat-error>
              </mat-form-field>

              <button
                mat-flat-button
                color="primary"
                type="submit"
                class="full-width login-btn"
                [disabled]="loginForm.invalid || loading()"
              >
                @if (loading()) {
                  <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                }
                <span>Iniciar Sesión</span>
              </button>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      .login-wrapper {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        padding: 24px;
      }

      .login-container {
        width: 100%;
        max-width: 420px;
      }

      .login-brand {
        text-align: center;
        margin-bottom: 32px;

        .brand-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #3b82f6;
          margin-bottom: 8px;
        }

        h1 {
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 4px;
        }

        p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }
      }

      .login-card {
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

        mat-card-content {
          padding: 32px;
        }
      }

      .login-title {
        font-size: 22px;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 4px;
        text-align: center;
      }

      .login-subtitle {
        font-size: 14px;
        color: #64748b;
        margin: 0 0 28px;
        text-align: center;
      }

      .full-width {
        width: 100%;
        margin-bottom: 16px;
      }

      .login-btn {
        height: 48px;
        font-size: 16px;
        font-weight: 600;
        margin-top: 8px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn-spinner {
        display: inline-block;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly hidePassword = signal(true);
  protected readonly loading = signal(false);

  protected readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading.set(true);
    this.loginForm.disable();

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.loginForm.enable();
        this.snackBar.open(
          err?.message ?? 'Credenciales inválidas. Intente nuevamente.',
          'Cerrar',
          { duration: 5000, panelClass: 'error-snackbar' }
        );
      },
    });
  }
}
