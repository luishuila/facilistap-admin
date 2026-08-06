import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { BaseChartDirective } from 'ng2-charts';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Legend,
  Title,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { finalize } from 'rxjs';
import { DashboardService } from './dashboard.service';
import { StatCardComponent } from './stat-card.component';
import type { DashboardStats, Activity } from '../../core/models/dashboard.interface';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Legend,
  Title,
  Tooltip,
);

const PQRS_STATUS_LABELS: Record<string, string> = {
  Pendiente: 'Pendiente',
  En_proceso: 'En proceso',
  'En proceso': 'En proceso',
  Respondido: 'Respondido',
  Cerrado: 'Cerrado',
  Rechazado: 'Rechazado',
};

const BLUE_COLORS = [
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a5f',
];

const ROLE_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatListModule,
    MatDividerModule,
    BaseChartDirective,
    StatCardComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly activity = signal<Activity[]>([]);
  protected readonly isStatsLoading = signal(true);
  protected readonly isActivityLoading = signal(true);
  protected readonly activityColumns = ['userName', 'description', 'createdAt'];

  public barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x',
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'PQRS por Estado', font: { size: 16 }, color: '#1e293b' },
      tooltip: { backgroundColor: '#1e293b', titleFont: { size: 14 }, bodyFont: { size: 13 } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b' } },
      y: { grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', stepSize: 1 }, border: { display: false } },
    },
  };

  public doughnutChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  public doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, color: '#64748b', font: { size: 13 } } },
      title: { display: true, text: 'Usuarios por Rol', font: { size: 16 }, color: '#1e293b' },
      tooltip: { backgroundColor: '#1e293b', titleFont: { size: 14 }, bodyFont: { size: 13 } },
    },
  };

  ngOnInit(): void {
    this.loadStats();
    this.loadActivity();
  }

  private loadStats(): void {
    this.isStatsLoading.set(true);
    this.dashboardService
      .getKpis()
      .pipe(finalize(() => this.isStatsLoading.set(false)))
      .subscribe({
        next: (res: any) => {
          const data = res;
          const stats: DashboardStats = {
            totalUsers: data.totalUsers ?? 0,
            activeUsers: data.activeUsers ?? 0,
            blockedUsers: data.blockedUsers ?? 0,
            totalProviders: data.totalProviders ?? 0,
            totalEmployees: data.totalEmployees ?? 0,
            totalCategories: data.totalCategories ?? 0,
            totalPqrs: data.totalComplaints ?? 0,
            totalComplaints: data.totalComplaints ?? 0,
            pqrsByStatus: data.complaintsByStatus ?? {},
            complaintsByStatus: data.complaintsByStatus ?? {},
            usersByRole: data.usersByRole ?? {},
          };
          this.stats.set(stats);
          this.buildBarChart(stats.complaintsByStatus ?? {});
          this.buildDoughnutChart(stats.usersByRole ?? {});
        },
        error: (err: unknown) => console.error('Failed to load stats', err),
      });
  }

  private loadActivity(): void {
    this.isActivityLoading.set(true);
    this.dashboardService
      .getAlerts()
      .pipe(finalize(() => this.isActivityLoading.set(false)))
      .subscribe({
        next: (res: any) => this.activity.set(res ?? []),
        error: (err: unknown) => console.error('Failed to load activity', err),
      });
  }

  private buildBarChart(pqrsByStatus: Record<string, number>): void {
    const entries = Object.entries(pqrsByStatus ?? {});
    const labels = entries.map(([key]) => PQRS_STATUS_LABELS[key] ?? key);
    const values = entries.map(([, val]) => val);

    this.barChartData = {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: BLUE_COLORS,
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
        },
      ],
    };
  }

  private buildDoughnutChart(usersByRole: Record<string, number>): void {
    const entries = Object.entries(usersByRole ?? {});
    const labels = entries.map(([key]) => this.formatRoleLabel(key));
    const values = entries.map(([, val]) => val);

    this.doughnutChartData = {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ROLE_COLORS.slice(0, entries.length),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverBorderColor: '#ffffff',
        },
      ],
    };
  }

  private formatRoleLabel(role: string): string {
    return role
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  protected formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHrs < 24) return `Hace ${diffHrs} h`;
    if (diffDays < 7) return `Hace ${diffDays} d`;

    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
