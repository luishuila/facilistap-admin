import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import { finalize } from 'rxjs';
import { DashboardService, SiteVisitStats } from './dashboard.service';

const PLATFORM_LABELS: Record<string, string> = { web: 'Página web', android: 'App Android', ios: 'App iPhone' };
const PLATFORM_ICONS: Record<string, string> = { web: 'language', android: 'android', ios: 'phone_iphone' };

/** Cuántas personas abren la página web y la app: hoy, 7 y 30 días, por día, plataforma y origen. */
@Component({
  selector: 'app-site-visits-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonToggleModule, MatProgressSpinnerModule, BaseChartDirective],
  templateUrl: './site-visits-card.component.html',
  styleUrl: './site-visits-card.component.scss',
})
export class SiteVisitsCardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly stats = signal<SiteVisitStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly days = signal(30);

  protected chartData: ChartData<'bar'> = { labels: [], datasets: [] };
  protected readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, color: '#64748b' } },
      tooltip: { backgroundColor: '#1e293b' },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
      y: { beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', precision: 0 }, border: { display: false } },
    },
  };

  ngOnInit(): void {
    this.load();
  }

  protected changeDays(days: number): void {
    if (days === this.days()) return;
    this.days.set(days);
    this.load();
  }

  protected platformLabel(platform: string): string {
    return PLATFORM_LABELS[platform] ?? platform;
  }

  protected platformIcon(platform: string): string {
    return PLATFORM_ICONS[platform] ?? 'devices';
  }

  /** Ancho de la barra de cada fila respecto a la mayor. */
  protected share(value: number, rows: Array<{ visits: number }>): number {
    const max = Math.max(1, ...rows.map((r) => r.visits));
    return Math.round((value / max) * 100);
  }

  private load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.dashboardService
      .getSiteVisits(this.days())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.buildChart(stats);
        },
        error: () => this.failed.set(true),
      });
  }

  private buildChart(stats: SiteVisitStats): void {
    const label = (iso: string) => {
      const [, m, d] = iso.split('-');
      return `${d}/${m}`;
    };
    this.chartData = {
      labels: stats.byDay.map((d) => label(d.date)),
      datasets: [
        { label: 'Personas', data: stats.byDay.map((d) => d.visitors), backgroundColor: '#1daeff', borderRadius: 4, barPercentage: 0.8 },
        { label: 'Visitas', data: stats.byDay.map((d) => d.visits), backgroundColor: '#1e3a5f', borderRadius: 4, barPercentage: 0.8 },
      ],
    };
  }
}
