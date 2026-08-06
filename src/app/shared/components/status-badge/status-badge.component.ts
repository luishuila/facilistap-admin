import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, MatChipsModule, MatIconModule],
  template: `
    <mat-chip
      class="status-badge"
      [style.background]="currentColor() + '20'"
      [style.color]="currentColor()"
      [style.border]="'1px solid ' + currentColor() + '40'"
    >
      @if (showDot) {
        <span class="status-dot" [style.background]="currentColor()"></span>
      }
      {{ label }}
    </mat-chip>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      .status-badge {
        font-weight: 600;
        font-size: 12px;
        height: 26px;
        padding: 0 12px;
        border-radius: 13px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
    `,
  ],
})
export class StatusBadgeComponent implements OnInit {
  @Input() status = '';
  @Input() colorMap: Record<string, string> = {};
  @Input() showDot = true;

  protected label = '';

  private readonly defaultColorMap: Record<string, string> = {
    active: '#22c55e',
    activo: '#22c55e',
    inactive: '#94a3b8',
    inactivo: '#94a3b8',
    blocked: '#ef4444',
    bloqueado: '#ef4444',
    pending: '#f59e0b',
    pendiente: '#f59e0b',
    completed: '#3b82f6',
    completado: '#3b82f6',
    open: '#3b82f6',
    abierto: '#3b82f6',
    closed: '#64748b',
    cerrado: '#64748b',
    in_progress: '#8b5cf6',
    en_progreso: '#8b5cf6',
    resolved: '#22c55e',
    resuelto: '#22c55e',
    draft: '#94a3b8',
    borrador: '#94a3b8',
    approved: '#22c55e',
    aprobado: '#22c55e',
    rejected: '#ef4444',
    rechazado: '#ef4444',
    cancelled: '#94a3b8',
    cancelado: '#94a3b8',
  };

  ngOnInit(): void {
    this.label = this.formatLabel(this.status);
  }

  protected currentColor(): string {
    const merged = { ...this.defaultColorMap, ...this.colorMap };
    return merged[this.status?.toLowerCase()] || '#94a3b8';
  }

  private formatLabel(value: string): string {
    if (!value) return 'N/A';
    return value
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
