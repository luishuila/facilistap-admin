import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusColor',
  standalone: true,
})
export class StatusColorPipe implements PipeTransform {
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
    rejected: '#ef4444',
    rechazado: '#ef4444',
    cancelled: '#94a3b8',
    cancelado: '#94a3b8',
    draft: '#94a3b8',
    borrador: '#94a3b8',
    approved: '#22c55e',
    aprobado: '#22c55e',
  };

  transform(status: string, customMap?: Record<string, string>, fallback?: string): string {
    if (!status) return fallback || '#94a3b8';
    const merged = { ...this.defaultColorMap, ...(customMap || {}) };
    return merged[status.toLowerCase()] || fallback || '#94a3b8';
  }
}
