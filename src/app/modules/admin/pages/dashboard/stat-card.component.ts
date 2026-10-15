import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

export type StatCardColor = 'primary' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <mat-card class="stat-card" [ngClass]="color">
      <div class="stat-content">
        <div class="stat-icon">
          <mat-icon [fontIcon]="icon"></mat-icon>
        </div>
        <div class="stat-info">
          <span class="stat-label">{{ label }}</span>
          <span class="stat-value">{{ value | number }}</span>
        </div>
      </div>
    </mat-card>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .stat-card {
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
        cursor: default;
        border-left: 4px solid transparent;

        &:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
          transform: translateY(-2px);
        }
      }

      .stat-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 4px 0;
      }

      .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 12px;
        flex-shrink: 0;

        mat-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
        }
      }

      .stat-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .stat-label {
        font-size: 13px;
        font-weight: 500;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.2;
      }

      /* Color themes */
      .primary {
        border-left-color: #1daeff;

        .stat-icon {
          background: rgba(29, 174, 255, 0.1);
          color: #1daeff;
        }
      }

      .success {
        border-left-color: #22c55e;

        .stat-icon {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }
      }

      .warning {
        border-left-color: #f59e0b;

        .stat-icon {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }
      }

      .danger {
        border-left-color: #ef4444;

        .stat-icon {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      }

      .info {
        border-left-color: #8b5cf6;

        .stat-icon {
          background: rgba(139, 92, 246, 0.1);
          color: #8b5cf6;
        }
      }
    `,
  ],
})
export class StatCardComponent {
  @Input() icon = '';
  @Input() label = '';
  @Input() value: number | null = 0;
  @Input() color: StatCardColor = 'primary';
}
