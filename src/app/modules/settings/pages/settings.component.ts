import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { finalize, forkJoin } from 'rxjs';

import { SettingsService } from '../settings.service';
import {
  SystemSetting,
  NotificationConfig,
  SecurityConfig,
  AuthConfig,
} from '../../../core/models/settings.interface';
import { ApiResponse } from '../../../core/models/api-response.interface';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

interface GeneralSettingForm {
  id: FormControl<number>;
  key: FormControl<string>;
  value: FormControl<string>;
  description: FormControl<string>;
  type: FormControl<string>;
  group: FormControl<string>;
  isEditable: FormControl<boolean>;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    LoadingSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-page">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Configuración del Sistema</h1>
          <p class="page-subtitle">Administre la configuración general, notificaciones, seguridad y autenticación</p>
        </div>
      </div>

      @if (initialLoading()) {
        <app-loading-spinner [overlay]="false" message="Cargando configuración..."></app-loading-spinner>
      } @else {
        <mat-card class="settings-card">
          <mat-card-content>
            <mat-tab-group
              animationDuration="200ms"
              [selectedIndex]="selectedTabIndex()"
              (selectedIndexChange)="onTabChange($event)"
            >
              <mat-tab label="General">
                <div class="tab-content">
                  @if (tabLoading()) {
                    <div class="tab-loading">
                      <mat-spinner [diameter]="36"></mat-spinner>
                    </div>
                  } @else if (generalSettings().length > 0) {
                    <form [formGroup]="generalForm" class="general-form">
                      @for (setting of generalSettings(); track setting.id) {
                        <div class="setting-card">
                          <div class="setting-header">
                            <span class="setting-key">{{ setting.key }}</span>
                            <span class="setting-type-badge">{{ setting.type }}</span>
                          </div>
                          <p class="setting-description">{{ setting.description }}</p>
                          <mat-form-field appearance="outline" class="setting-input" subscriptSizing="dynamic">
                            <mat-label>Valor</mat-label>
                            @if (setting.type === 'BOOLEAN') {
                              <mat-slide-toggle [formControlName]="setting.key" color="primary">
                                {{ getFormValue(setting.key) ? 'Activado' : 'Desactivado' }}
                              </mat-slide-toggle>
                            } @else if (setting.type === 'NUMBER') {
                              <input matInput type="number" [formControlName]="setting.key" />
                            } @else {
                              <input matInput type="text" [formControlName]="setting.key" />
                            }
                          </mat-form-field>
                        </div>
                      }
                      <div class="form-actions">
                        <button
                          mat-flat-button
                          color="primary"
                          (click)="saveGeneral()"
                          [disabled]="tabSaving() || !generalForm.dirty"
                        >
                          <mat-icon>save</mat-icon>
                          <span>Guardar Cambios</span>
                        </button>
                      </div>
                    </form>
                  } @else {
                    <p class="empty-tab">No hay configuraciones generales disponibles</p>
                  }
                </div>
              </mat-tab>

              <mat-tab label="Notificaciones">
                <div class="tab-content">
                  @if (tabLoading()) {
                    <div class="tab-loading">
                      <mat-spinner [diameter]="36"></mat-spinner>
                    </div>
                  } @else {
                    <form [formGroup]="notificationForm" class="config-form">
                      <div class="config-grid">
                        <div class="config-item">
                          <div class="config-info">
                            <span class="config-label">Correo Electrónico</span>
                            <span class="config-hint">Habilitar notificaciones por correo electrónico</span>
                          </div>
                          <mat-slide-toggle formControlName="emailEnabled" color="primary"></mat-slide-toggle>
                        </div>
                        <mat-divider></mat-divider>
                        <div class="config-item">
                          <div class="config-info">
                            <span class="config-label">Mensajes SMS</span>
                            <span class="config-hint">Habilitar notificaciones por mensaje de texto</span>
                          </div>
                          <mat-slide-toggle formControlName="smsEnabled" color="primary"></mat-slide-toggle>
                        </div>
                        <mat-divider></mat-divider>
                        <div class="config-item">
                          <div class="config-info">
                            <span class="config-label">Notificaciones Push</span>
                            <span class="config-hint">Habilitar notificaciones push en dispositivos móviles</span>
                          </div>
                          <mat-slide-toggle formControlName="pushEnabled" color="primary"></mat-slide-toggle>
                        </div>
                      </div>
                      <div class="form-actions">
                        <button
                          mat-flat-button
                          color="primary"
                          (click)="saveNotifications()"
                          [disabled]="tabSaving() || !notificationForm.dirty"
                        >
                          <mat-icon>save</mat-icon>
                          <span>Guardar Cambios</span>
                        </button>
                      </div>
                    </form>
                  }
                </div>
              </mat-tab>

              <mat-tab label="Seguridad">
                <div class="tab-content">
                  @if (tabLoading()) {
                    <div class="tab-loading">
                      <mat-spinner [diameter]="36"></mat-spinner>
                    </div>
                  } @else {
                    <form [formGroup]="securityForm" class="config-form">
                      <div class="form-grid">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Intentos Máximos de Inicio</mat-label>
                          <input matInput type="number" formControlName="maxLoginAttempts" />
                          <mat-hint>Número de intentos fallidos antes del bloqueo</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Tiempo de Sesión (minutos)</mat-label>
                          <input matInput type="number" formControlName="sessionTimeout" />
                          <mat-hint>Tiempo de inactividad antes de cerrar sesión</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Longitud Mínima de Contraseña</mat-label>
                          <input matInput type="number" formControlName="passwordMinLength" />
                          <mat-hint>Cantidad mínima de caracteres requeridos</mat-hint>
                        </mat-form-field>

                        <div class="config-item">
                          <div class="config-info">
                            <span class="config-label">Autenticación de Dos Factores</span>
                            <span class="config-hint">Requerir verificación en dos pasos para el inicio de sesión</span>
                          </div>
                          <mat-slide-toggle formControlName="requireMfa" color="primary"></mat-slide-toggle>
                        </div>
                      </div>
                      <div class="form-actions">
                        <button
                          mat-flat-button
                          color="primary"
                          (click)="saveSecurity()"
                          [disabled]="tabSaving() || !securityForm.dirty"
                        >
                          <mat-icon>save</mat-icon>
                          <span>Guardar Cambios</span>
                        </button>
                      </div>
                    </form>
                  }
                </div>
              </mat-tab>

              <mat-tab label="Autenticación">
                <div class="tab-content">
                  @if (tabLoading()) {
                    <div class="tab-loading">
                      <mat-spinner [diameter]="36"></mat-spinner>
                    </div>
                  } @else {
                    <form [formGroup]="authForm" class="config-form">
                      <div class="form-grid">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>JWT Secret</mat-label>
                          <input matInput type="text" formControlName="jwtSecret" />
                          <mat-hint>Clave secreta para firmar tokens JWT</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Expiración JWT</mat-label>
                          <input matInput type="text" formControlName="jwtExpiration" placeholder="Ej: 24h, 60m" />
                          <mat-hint>Tiempo de expiración del token de acceso</mat-hint>
                        </mat-form-field>

                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Expiración Refresh Token</mat-label>
                          <input matInput type="text" formControlName="refreshTokenExpiration" placeholder="Ej: 7d, 30d" />
                          <mat-hint>Tiempo de expiración del token de refresco</mat-hint>
                        </mat-form-field>
                      </div>
                      <div class="form-actions">
                        <button
                          mat-flat-button
                          color="primary"
                          (click)="saveAuth()"
                          [disabled]="tabSaving() || !authForm.dirty"
                        >
                          <mat-icon>save</mat-icon>
                          <span>Guardar Cambios</span>
                        </button>
                      </div>
                    </form>
                  }
                </div>
              </mat-tab>
            </mat-tab-group>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .settings-page {
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
      }

      .page-header {
        margin-bottom: 24px;
      }

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .page-title {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.2;
      }

      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: #94a3b8;
        font-weight: 400;
      }

      .settings-card {
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

        ::ng-deep .mat-mdc-card-content {
          padding: 0;
        }

        ::ng-deep .mat-mdc-tab-header {
          background: #f8fafc;
          border-radius: 12px 12px 0 0;
          border-bottom: 1px solid #e2e8f0;
        }

        ::ng-deep .mat-mdc-tab-body-wrapper {
          min-height: 400px;
        }
      }

      .tab-content {
        padding: 24px;
        min-height: 360px;
      }

      .tab-loading {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 200px;
      }

      .empty-tab {
        text-align: center;
        color: #94a3b8;
        font-size: 14px;
        padding: 48px 0;
        margin: 0;
      }

      .general-form {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .setting-card {
        padding: 20px 0;
        border-bottom: 1px solid #f1f5f9;

        &:last-of-type {
          border-bottom: none;
        }
      }

      .setting-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .setting-key {
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      }

      .setting-type-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        color: #6366f1;
        background: #eef2ff;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .setting-description {
        margin: 0 0 12px;
        font-size: 13px;
        color: #94a3b8;
      }

      .setting-input {
        width: 100%;

        ::ng-deep .mat-mdc-slide-toggle {
          margin: 8px 0;
        }
      }

      .config-form {
        display: flex;
        flex-direction: column;
      }

      .config-grid {
        display: flex;
        flex-direction: column;
      }

      .config-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 0;
      }

      .config-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .config-label {
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
      }

      .config-hint {
        font-size: 13px;
        color: #94a3b8;
      }

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        align-items: start;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        padding-top: 24px;
        margin-top: 8px;
        border-top: 1px solid #f1f5f9;

        button {
          border-radius: 8px;
          font-weight: 600;
          height: 44px;
          padding: 0 24px;
        }
      }

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        font-size: 12px;
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly initialLoading = signal(true);
  protected readonly tabLoading = signal(false);
  protected readonly tabSaving = signal(false);
  protected readonly selectedTabIndex = signal(0);

  protected readonly generalSettings = signal<SystemSetting[]>([]);

  protected generalForm = this.fb.group<Record<string, unknown>>({});
  protected readonly notificationForm = this.fb.group({
    emailEnabled: this.fb.control(false, { nonNullable: true }),
    smsEnabled: this.fb.control(false, { nonNullable: true }),
    pushEnabled: this.fb.control(false, { nonNullable: true }),
  });
  protected readonly securityForm = this.fb.group({
    maxLoginAttempts: this.fb.control(0, { nonNullable: true }),
    sessionTimeout: this.fb.control(0, { nonNullable: true }),
    passwordMinLength: this.fb.control(0, { nonNullable: true }),
    requireMfa: this.fb.control(false, { nonNullable: true }),
  });
  protected readonly authForm = this.fb.group({
    jwtSecret: this.fb.control('', { nonNullable: true }),
    jwtExpiration: this.fb.control('', { nonNullable: true }),
    refreshTokenExpiration: this.fb.control('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadAllSettings();
  }

  protected getFormValue(key: string): boolean {
    return !!this.generalForm.get(key)?.value;
  }

  protected onTabChange(index: number): void {
    this.selectedTabIndex.set(index);

    if (index === 0) this.loadGeneralSettings();
    else if (index === 1) this.loadNotificationConfig();
    else if (index === 2) this.loadSecurityConfig();
    else if (index === 3) this.loadAuthConfig();
  }

  private loadAllSettings(): void {
    this.initialLoading.set(true);

    this.settingsService
      .getByGroup('general')
      .pipe(
        finalize(() => this.initialLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res: ApiResponse<SystemSetting[]>) => {
          this.generalSettings.set(res.data!);
          this.buildGeneralForm(res.data!);
        },
        error: () => {
          this.snackBar.open('Error al cargar configuración general', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private loadGeneralSettings(): void {
    this.tabLoading.set(true);

    this.settingsService
      .getByGroup('general')
      .pipe(
        finalize(() => this.tabLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res: ApiResponse<SystemSetting[]>) => {
          this.generalSettings.set(res.data!);
          this.buildGeneralForm(res.data!);
        },
        error: () => {
          this.snackBar.open('Error al cargar configuración general', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private loadNotificationConfig(): void {
    this.tabLoading.set(true);

    this.settingsService
      .getNotificationConfig()
      .pipe(
        finalize(() => this.tabLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res: ApiResponse<NotificationConfig>) => {
          this.notificationForm.setValue({
            emailEnabled: res.data!.emailEnabled,
            smsEnabled: res.data!.smsEnabled,
            pushEnabled: res.data!.pushEnabled,
          });
          this.notificationForm.markAsPristine();
        },
        error: () => {
          this.snackBar.open('Error al cargar configuración de notificaciones', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private loadSecurityConfig(): void {
    this.tabLoading.set(true);

    this.settingsService
      .getSecurityConfig()
      .pipe(
        finalize(() => this.tabLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res: ApiResponse<SecurityConfig>) => {
          this.securityForm.setValue({
            maxLoginAttempts: res.data!.maxLoginAttempts,
            sessionTimeout: res.data!.sessionTimeout,
            passwordMinLength: res.data!.passwordMinLength,
            requireMfa: res.data!.requireMfa,
          });
          this.securityForm.markAsPristine();
        },
        error: () => {
          this.snackBar.open('Error al cargar configuración de seguridad', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private loadAuthConfig(): void {
    this.tabLoading.set(true);

    this.settingsService
      .getAuthConfig()
      .pipe(
        finalize(() => this.tabLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res: ApiResponse<AuthConfig>) => {
          this.authForm.setValue({
            jwtSecret: res.data!.jwtSecret,
            jwtExpiration: res.data!.jwtExpiration,
            refreshTokenExpiration: res.data!.refreshTokenExpiration,
          });
          this.authForm.markAsPristine();
        },
        error: () => {
          this.snackBar.open('Error al cargar configuración de autenticación', 'Cerrar', { duration: 5000 });
        },
      });
  }

  private buildGeneralForm(settings: SystemSetting[]): void {
    const controls: Record<string, FormControl<unknown>> = {};

    for (const setting of settings) {
      let value: unknown = setting.value;

      if (setting.type === 'BOOLEAN') {
        value = setting.value === 'true' || setting.value === '1';
      } else if (setting.type === 'NUMBER') {
        value = Number(setting.value) || 0;
      }

      controls[setting.key] = this.fb.control(
        { value, disabled: !setting.isEditable },
        { nonNullable: true },
      );
    }

    this.generalForm = this.fb.group(controls);
    this.generalForm.markAsPristine();
  }

  protected saveGeneral(): void {
    if (!this.generalForm.valid) return;

    this.tabSaving.set(true);

    const updates = this.generalSettings().map((setting) => {
      const control = this.generalForm.get(setting.key);
      if (!control) return null;

      let value = control.value;

      if (setting.type === 'BOOLEAN') {
        value = value ? 'true' : 'false';
      } else if (setting.type === 'NUMBER') {
        value = String(value);
      }

      if (value === setting.value) return null;

      return this.settingsService.update(setting.id, { value: value as string });
    });

    const validUpdates = updates.filter(Boolean);

    if (validUpdates.length === 0) {
      this.tabSaving.set(false);
      this.snackBar.open('No hay cambios para guardar', 'Cerrar', { duration: 3000 });
      return;
    }

    forkJoin(validUpdates)
      .pipe(
        finalize(() => this.tabSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.generalForm.markAsPristine();
          this.snackBar.open('Configuración general guardada correctamente', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Error al guardar configuración general', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected saveNotifications(): void {
    if (!this.notificationForm.valid) return;

    this.tabSaving.set(true);

    const data: NotificationConfig = this.notificationForm.getRawValue();

    this.settingsService
      .updateNotificationConfig(data)
      .pipe(
        finalize(() => this.tabSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificationForm.markAsPristine();
          this.snackBar.open('Configuración de notificaciones guardada correctamente', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Error al guardar configuración de notificaciones', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected saveSecurity(): void {
    if (!this.securityForm.valid) return;

    this.tabSaving.set(true);

    const data: SecurityConfig = this.securityForm.getRawValue();

    this.settingsService
      .updateSecurityConfig(data)
      .pipe(
        finalize(() => this.tabSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.securityForm.markAsPristine();
          this.snackBar.open('Configuración de seguridad guardada correctamente', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Error al guardar configuración de seguridad', 'Cerrar', { duration: 5000 });
        },
      });
  }

  protected saveAuth(): void {
    if (!this.authForm.valid) return;

    this.tabSaving.set(true);

    const data: AuthConfig = this.authForm.getRawValue();

    this.settingsService
      .updateAuthConfig(data)
      .pipe(
        finalize(() => this.tabSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.authForm.markAsPristine();
          this.snackBar.open('Configuración de autenticación guardada correctamente', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Error al guardar configuración de autenticación', 'Cerrar', { duration: 5000 });
        },
      });
  }
}
