import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  color?: string;
  showCancel?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-header">
        @if (data.icon) {
          <div class="icon-wrapper" [style.background]="(data.color || '#ef4444') + '18'">
            <mat-icon [style.color]="data.color || '#ef4444'">{{ data.icon }}</mat-icon>
          </div>
        }
        <h2 class="dialog-title">{{ data.title }}</h2>
      </div>
      <div class="dialog-content">
        <p>{{ data.message }}</p>
      </div>
      <div class="dialog-actions">
        @if (data.showCancel !== false) {
          <button mat-stroked-button (click)="onCancel()">
            {{ data.cancelText || 'Cancelar' }}
          </button>
        }
        <button
          mat-flat-button
          [style.background]="data.color || '#ef4444'"
          [style.color]="'#fff'"
          (click)="onConfirm()"
          cdkFocusInitial
        >
          {{ data.confirmText || 'Confirmar' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .confirm-dialog {
        padding: 8px;
        min-width: 360px;
        max-width: 480px;
      }

      .dialog-header {
        text-align: center;
        margin-bottom: 8px;
      }

      .icon-wrapper {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }
      }

      .dialog-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
      }

      .dialog-content {
        text-align: center;
        padding: 0 16px;

        p {
          margin: 0;
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
        }
      }

      .dialog-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        padding: 24px 16px 8px;

        button {
          border-radius: 8px;
          padding: 0 24px;
          font-weight: 500;
          min-width: 100px;
        }
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  protected readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

  protected onConfirm(): void {
    this.dialogRef.close(true);
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }
}
