import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <mat-icon class="empty-icon">{{ icon }}</mat-icon>
      </div>
      <h3 class="empty-title">{{ title }}</h3>
      <p class="empty-message">{{ message }}</p>
      @if (showAction) {
        <button mat-flat-button color="primary" class="empty-action" (click)="onAction()">
          <mat-icon>add</mat-icon>
          <span>{{ actionLabel }}</span>
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 24px;
        text-align: center;
      }

      .empty-icon-wrapper {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }

      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #94a3b8;
      }

      .empty-title {
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 600;
        color: #475569;
      }

      .empty-message {
        margin: 0 0 24px;
        font-size: 14px;
        color: #94a3b8;
        max-width: 320px;
        line-height: 1.5;
      }

      .empty-action {
        border-radius: 8px;
        font-weight: 500;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Sin datos';
  @Input() message = 'No se encontraron resultados';
  @Input() showAction = false;
  @Input() actionLabel = 'Agregar';
  @Output() action = new EventEmitter<void>();

  protected onAction(): void {
    this.action.emit();
  }
}
