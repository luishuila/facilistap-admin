import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    @if (overlay) {
      <div class="spinner-overlay">
        <div class="spinner-wrapper">
          <mat-spinner [diameter]="diameter" [color]="'primary'"></mat-spinner>
          @if (message) {
            <p class="spinner-message">{{ message }}</p>
          }
        </div>
      </div>
    } @else {
      <div class="spinner-inline">
        <mat-spinner [diameter]="diameter" [color]="'primary'"></mat-spinner>
        @if (message) {
          <p class="spinner-message">{{ message }}</p>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .spinner-overlay {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        border-radius: inherit;
      }

      .spinner-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .spinner-inline {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 32px;
      }

      .spinner-message {
        margin: 0;
        font-size: 14px;
        color: #64748b;
        font-weight: 500;
      }
    `,
  ],
})
export class LoadingSpinnerComponent {
  @Input() diameter = 50;
  @Input() message = 'Cargando...';
  @Input() overlay = false;
}
