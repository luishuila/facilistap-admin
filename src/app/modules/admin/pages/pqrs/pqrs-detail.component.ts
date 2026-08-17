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
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { HttpEventType } from '@angular/common/http';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { PqrsService } from '../../services/pqrs.service';
import { UserService } from '../../services/user.service';
import {
  PQRS,
  PqrsResponse,
  PqrsFile,
  PqrsStatus,
  PqrsType,
} from '../../../../core/models/pqrs.interface';
import { User } from '../../../../core/models/user.interface';
import { PaginatedQuery } from '../../../../core/models/paginated-query.interface';

const STATUS_COLORS: Record<PqrsStatus, string> = {
  PENDIENTE: '#f59e0b',
  EN_PROCESO: '#3b82f6',
  RESPONDIDO: '#10b981',
  CERRADO: '#6b7280',
  RECHAZADO: '#ef4444',
};

const STATUS_LABELS: Record<PqrsStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  RESPONDIDO: 'Respondido',
  CERRADO: 'Cerrado',
  RECHAZADO: 'Rechazado',
};

const TYPE_LABELS: Record<PqrsType, string> = {
  QUEJA: 'Queja',
  PETICION: 'Petición',
  RECLAMO: 'Reclamo',
  SUGERENCIA: 'Sugerencia',
};

@Component({
  selector: 'app-pqrs-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDividerModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pqrs-detail">
      <div class="dialog-header">
        <h2 class="dialog-title">Detalle PQRS #{{ pqrs()?.id }}</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <app-loading-spinner [diameter]="40" [message]="'Cargando...'" />
      } @else if (pqrs()) {
        <mat-tab-group dynamicHeight animationDuration="200ms">
          <mat-tab label="Información">
            <div class="tab-content">
              <div class="info-grid">
                <div class="info-row">
                  <span class="info-label">Tipo</span>
                  <app-status-badge
                    [status]="pqrs()!.type"
                    [colorMap]="typeColorMap"
                  />
                </div>
                <div class="info-row">
                  <span class="info-label">Estado</span>
                  <app-status-badge
                    [status]="pqrs()!.status"
                    [colorMap]="statusColorMap"
                  />
                </div>
                <div class="info-row">
                  <span class="info-label">Asunto</span>
                  <span class="info-value">{{ pqrs()!.subject }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Usuario</span>
                  <span class="info-value">{{ pqrs()!.userName }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Asignado a</span>
                  <span class="info-value">{{ pqrs()!.assignedToName || 'Sin asignar' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Fecha creación</span>
                  <span class="info-value">{{ pqrs()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
              </div>

              <mat-divider class="section-divider" />

              <div class="description-section">
                <h4 class="section-title">Descripción</h4>
                <p class="description-text">{{ pqrs()!.description }}</p>
              </div>
            </div>
          </mat-tab>

          <mat-tab label="Respuestas">
            <div class="tab-content">
              @if (responses().length === 0) {
                <div class="empty-section">
                  <mat-icon>chat_bubble_outline</mat-icon>
                  <p>No hay respuestas registradas</p>
                </div>
              } @else {
                <div class="responses-timeline">
                  @for (resp of responses(); track resp.id) {
                    <div class="timeline-item">
                      <div class="timeline-marker">
                        <mat-icon>chat_bubble</mat-icon>
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-header">
                          <span class="timeline-user">{{ resp.userName }}</span>
                          <span class="timeline-date">{{ resp.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                        </div>
                        <p class="timeline-text">{{ resp.response }}</p>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <mat-tab label="Archivos">
            <div class="tab-content">
              @if (files().length === 0) {
                <div class="empty-section">
                  <mat-icon>attach_file</mat-icon>
                  <p>No hay archivos adjuntos</p>
                </div>
              } @else {
                <div class="files-list">
                  @for (file of files(); track file.id) {
                    <div class="file-item">
                      <mat-icon class="file-icon">insert_drive_file</mat-icon>
                      <span class="file-name">{{ file.fileName }}</span>
                      <span class="file-type">{{ file.fileType }}</span>
                      <a mat-icon-button [href]="file.fileUrl" target="_blank" matTooltip="Descargar">
                        <mat-icon>download</mat-icon>
                      </a>
                    </div>
                  }
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>

        @if (!isClosedStatus(pqrs()!.status)) {
          <mat-divider class="action-divider" />
          <div class="management-section">
            <h4 class="section-title">Gestionar PQRS</h4>

            <form [formGroup]="responseForm" class="management-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Respuesta</mat-label>
                <textarea matInput formControlName="response" rows="4" placeholder="Escriba su respuesta..."></textarea>
                @if (responseForm.get('response')?.hasError('required')) {
                  <mat-error>La respuesta es requerida</mat-error>
                }
              </mat-form-field>

              <div class="management-actions-row">
                <mat-form-field appearance="outline" class="action-field">
                  <mat-label>Estado</mat-label>
                  <mat-select formControlName="status">
                    @for (st of selectableStatuses; track st.value) {
                      <mat-option [value]="st.value">
                        <div class="status-option">
                          <span class="status-dot" [style.background]="st.color"></span>
                          <span>{{ st.label }}</span>
                        </div>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="action-field">
                  <mat-label>Asignar a</mat-label>
                  <mat-select formControlName="assignedToId">
                    <mat-option [value]="null">Sin asignar</mat-option>
                    @for (user of userList(); track user.id) {
                      <mat-option [value]="user.id">{{ user.fullName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <div class="file-upload-wrapper">
                  <button mat-stroked-button type="button" (click)="fileInput.click()">
                    <mat-icon>upload</mat-icon>
                    Adjuntar archivo
                  </button>
                  <input #fileInput type="file" hidden (change)="onFileSelected($event)" />
                  @if (selectedFile()) {
                    <span class="selected-file-name">{{ selectedFile()!.name }}</span>
                  }
                </div>

                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="submitting()"
                  (click)="onSubmitManagement()"
                >
                  @if (submitting()) {
                    <mat-spinner [diameter]="20" color="accent" />
                  } @else {
                    <span>Enviar</span>
                  }
                </button>
              </div>
            </form>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .pqrs-detail {
        max-height: 85vh;
        overflow-y: auto;
        padding: 8px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .dialog-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
      }

      .tab-content {
        padding: 20px 8px;
      }

      .info-grid {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .info-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .info-label {
        font-size: 14px;
        font-weight: 600;
        color: #64748b;
        min-width: 120px;
        flex-shrink: 0;
      }

      .info-value {
        font-size: 14px;
        color: #1e293b;
      }

      .section-divider {
        margin: 24px 0;
      }

      .section-title {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
      }

      .description-text {
        margin: 0;
        font-size: 14px;
        color: #475569;
        line-height: 1.7;
        white-space: pre-wrap;
      }

      .empty-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 16px;
        color: #94a3b8;
        gap: 8px;

        mat-icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
        }

        p {
          margin: 0;
          font-size: 14px;
        }
      }

      .responses-timeline {
        position: relative;
        padding-left: 28px;
      }

      .timeline-item {
        position: relative;
        padding-bottom: 20px;
      }

      .timeline-marker {
        position: absolute;
        left: -28px;
        top: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #e0e7ff;
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #6366f1;
        }
      }

      .timeline-content {
        background: #f8fafc;
        border-radius: 8px;
        padding: 14px 16px;
      }

      .timeline-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 12px;
      }

      .timeline-user {
        font-weight: 600;
        color: #334155;
      }

      .timeline-date {
        color: #94a3b8;
      }

      .timeline-text {
        margin: 0;
        font-size: 14px;
        color: #475569;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .files-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .file-item {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #f8fafc;
        border-radius: 8px;
        padding: 10px 14px;
      }

      .file-icon {
        color: #6366f1;
      }

      .file-name {
        flex: 1;
        font-size: 14px;
        color: #1e293b;
        font-weight: 500;
      }

      .file-type {
        font-size: 12px;
        color: #94a3b8;
        text-transform: uppercase;
      }

      .action-divider {
        margin: 20px 0;
      }

      .management-section {
        padding: 0 8px;
      }

      .management-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .management-actions-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .action-field {
        width: 180px;

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
          display: none;
        }
      }

      .status-option {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .file-upload-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .selected-file-name {
        font-size: 12px;
        color: #64748b;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class PqrsDetailComponent implements OnInit {
  private readonly pqrsService = inject(PqrsService);
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<PqrsDetailComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data: { pqrsId: number } = inject(MAT_DIALOG_DATA);

  protected readonly pqrs = signal<PQRS | null>(null);
  protected readonly responses = signal<PqrsResponse[]>([]);
  protected readonly files = signal<PqrsFile[]>([]);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly userList = signal<User[]>([]);

  protected readonly statusColorMap = STATUS_COLORS;
  protected readonly typeColorMap: Record<string, string> = {
    QUEJA: '#ef4444',
    PETICION: '#3b82f6',
    RECLAMO: '#f59e0b',
    SUGERENCIA: '#10b981',
  };

  protected readonly selectableStatuses = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as PqrsStatus,
    label,
    color: STATUS_COLORS[value as PqrsStatus],
  }));

  protected responseForm = this.fb.group({
    response: ['', [Validators.required]],
    status: ['' as string],
    assignedToId: [null as number | null],
  });

  ngOnInit(): void {
    this.loadPqrs();
    this.loadUsers();
  }

  protected isClosedStatus(status: PqrsStatus): boolean {
    return status === 'CERRADO' || status === 'RECHAZADO';
  }

  private loadPqrs(): void {
    this.loading.set(true);

    this.pqrsService
      .getById(this.data.pqrsId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          const item = res.data!;
          if (!item) return;
          this.pqrs.set(item);
          this.responses.set(item.responses || []);
          this.files.set(item.files || []);

          this.responseForm.patchValue({
            status: item.status,
            assignedToId: item.assignedToId,
          });
        },
        error: () => {
          this.snackBar.open('Error al cargar el PQRS', 'Cerrar', { duration: 5000 });
          this.dialogRef.close(false);
        },
      });
  }

  private loadUsers(): void {
    const query: PaginatedQuery = { limit: 200 };
    this.userService
      .getAll(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.userList.set(res.items.filter((u) => u.isActive && !u.isBlocked));
        },
      });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
    }
  }

  protected onSubmitManagement(): void {
    if (this.responseForm.get('response')?.invalid) {
      this.responseForm.get('response')?.markAsTouched();
      return;
    }

    this.submitting.set(true);
    const pqrsId = this.data.pqrsId;
    const value = this.responseForm.value;

    this.pqrsService
      .respond(pqrsId, value.response!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.afterRespond(pqrsId, value.status, value.assignedToId ?? undefined),
        error: () => {
          this.snackBar.open('Error al enviar respuesta', 'Cerrar', { duration: 5000 });
          this.submitting.set(false);
        },
      });
  }

  private afterRespond(pqrsId: number, newStatus?: string | null, assignedToId?: number | null): void {
    const operations: Promise<void>[] = [];

    if (newStatus && newStatus !== this.pqrs()?.status) {
      operations.push(
        new Promise<void>((resolve, reject) => {
          this.pqrsService
            .changeStatus(pqrsId, newStatus as PqrsStatus)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: () => resolve(), error: () => reject() });
        }),
      );
    }

    if (assignedToId != null && assignedToId !== this.pqrs()?.assignedToId) {
      operations.push(
        new Promise<void>((resolve, reject) => {
          this.pqrsService
            .assign(pqrsId, assignedToId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: () => resolve(), error: () => reject() });
        }),
      );
    }

    if (this.selectedFile()) {
      const formData = new FormData();
      formData.append('file', this.selectedFile()!);
      operations.push(
        new Promise<void>((resolve, reject) => {
          this.pqrsService
            .uploadFile(pqrsId, formData)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: () => resolve(), error: () => reject() });
        }),
      );
    }

    Promise.all(operations)
      .then(() => {
        this.snackBar.open('Gestión realizada correctamente', 'Cerrar', { duration: 3000 });
        this.loadPqrs();
        this.responseForm.get('response')?.reset();
        this.selectedFile.set(null);
        this.submitting.set(false);
      })
      .catch(() => {
        this.snackBar.open('Error en alguna de las operaciones', 'Cerrar', { duration: 5000 });
        this.submitting.set(false);
      });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
