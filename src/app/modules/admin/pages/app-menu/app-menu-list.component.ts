import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, finalize } from 'rxjs';

import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { AppMenuItem, AppMenuRole, AppMenuService, AppMenuTargets } from '../../services/app-menu.service';
import { AppMenuFormComponent, AppMenuFormData } from './app-menu-form.component';

interface Section {
  name: string;
  items: AppMenuItem[];
}

@Component({
  selector: 'app-app-menu-list',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Menú de la app</h1>
          <p class="page-subtitle">
            Menús de la app: la <strong>barra inferior</strong> (TABS) y <strong>"Mi cuenta"</strong> (SETTINGS). Active o desactive,
            ordene, cambie el nombre, el ícono y quién ve cada opción según su rol. Se aplica en la app sin publicar una versión nueva.
          </p>
        </div>
        <button mat-flat-button color="primary" class="add-btn" (click)="openForm()">
          <mat-icon>add</mat-icon>
          <span>Nueva opción</span>
        </button>
      </div>

      @if (loading()) {
        <div class="empty"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (!sections().length) {
        <div class="empty card"><mat-icon>menu_open</mat-icon><span>No hay opciones de menú.</span></div>
      }

      @for (sec of sections(); track sec.name) {
        <div class="card">
          <div class="card-head">
            <strong>{{ sectionLabel(sec.name) }}</strong>
            <span>{{ sec.items.length }} opciones · {{ activeCount(sec) }} activas</span>
          </div>
          @for (it of sec.items; track it.id; let i = $index; let first = $first; let last = $last) {
            <div class="row" [class.inactive]="!it.isActive">
              <div class="order">
                <button mat-icon-button type="button" matTooltip="Subir" [disabled]="first || busy()" (click)="move(sec, i, -1)">
                  <mat-icon>keyboard_arrow_up</mat-icon>
                </button>
                <button mat-icon-button type="button" matTooltip="Bajar" [disabled]="last || busy()" (click)="move(sec, i, 1)">
                  <mat-icon>keyboard_arrow_down</mat-icon>
                </button>
              </div>
              <div class="main">
                <strong>{{ labelOf(it) }}</strong>
                <small><code>{{ it.code }}</code> · {{ it.link }} · ícono {{ it.icon }}</small>
                <div class="roles">
                  @for (r of it.roles; track r) {
                    <span class="chip">{{ roleLabel(r) }}</span>
                  }
                  @for (id of it.roleIds; track id) {
                    <span class="chip role" matTooltip="Rol (Gestión de Roles)">{{ tableRoleName(id) }}</span>
                  }
                  @for (id of it.employeeRoleTypeIds; track id) {
                    <span class="chip emp" matTooltip="Rol de empleado">{{ employeeTypeName(id) }}</span>
                  }
                  @for (u of it.users ?? []; track u.id) {
                    <span class="chip user" [matTooltip]="u.email">{{ u.name || u.email }}</span>
                  }
                  @if (!it.roles.length && !it.roleIds.length && !it.employeeRoleTypeIds.length && !it.userIds.length) {
                    <span class="chip warn">Sin destinatarios: nadie la ve</span>
                  }
                </div>
              </div>
              <mat-slide-toggle color="primary" [checked]="it.isActive" [disabled]="busy()" (change)="toggle(it, $event.checked)"
                [matTooltip]="it.isActive ? 'Visible en la app' : 'Oculta en la app'" />
              <button mat-icon-button type="button" matTooltip="Editar" (click)="openForm(it)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button type="button" matTooltip="Eliminar" class="danger" (click)="remove(it)"><mat-icon>delete</mat-icon></button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .list-page { padding: 24px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
      .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 760px; }
      .add-btn { border-radius: 12px; height: 44px; padding: 0 20px; display: inline-flex; align-items: center; gap: 8px; }
      .card { background: var(--fac-surface, #fff); border: 1px solid var(--fac-border); border-radius: 14px; overflow: hidden; }
      .card-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--fac-border);
        background: #f8fafc; strong { font-size: 15px; color: var(--fac-text); } span { font-size: 12px; color: var(--fac-text-muted); } }
      .row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--fac-border);
        &:last-child { border-bottom: none; } &.inactive .main { opacity: 0.5; } }
      .order { display: flex; flex-direction: column; button { width: 32px; height: 28px; padding: 0; line-height: 28px; } }
      .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;
        strong { font-size: 14px; color: var(--fac-text); }
        small { font-size: 12px; color: var(--fac-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
      code { background: #f1f5f9; padding: 1px 6px; border-radius: 6px; }
      .roles { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
      .chip { font-size: 11px; font-weight: 600; color: #0078ff; background: #e0efff; padding: 2px 8px; border-radius: 999px;
        &.warn { color: #b45309; background: #fef3c7; }
        &.role { color: #7c3aed; background: #ede9fe; }
        &.emp { color: #0f766e; background: #ccfbf1; }
        &.user { color: #475569; background: #e2e8f0; } }
      .danger mat-icon { color: #ef4444; }
      .empty { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 36px; color: var(--fac-text-muted); }
    `,
  ],
})
export class AppMenuListComponent implements OnInit {
  private readonly service = inject(AppMenuService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<AppMenuItem[]>([]);
  protected readonly roles = signal<AppMenuRole[]>([]);
  protected readonly targets = signal<AppMenuTargets>({ roles: [], employeeRoleTypes: [] });
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);

  protected readonly sections = computed<Section[]>(() => {
    const map = new Map<string, AppMenuItem[]>();
    for (const it of this.items()) map.set(it.section, [...(map.get(it.section) ?? []), it]);
    return [...map.entries()].map(([name, items]) => ({
      name,
      items: [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    }));
  });

  ngOnInit(): void {
    this.service
      .roles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => this.roles.set(r));
    this.service
      .targets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((t) => this.targets.set(t));
    this.load();
  }

  private load(): void {
    this.loading.set(!this.items().length);
    this.service
      .list()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (list) => this.items.set(list),
        error: (err: Error) => this.snackBar.open(err?.message || 'Error al cargar el menú', 'Cerrar', { duration: 5000 }),
      });
  }

  protected sectionLabel(name: string): string {
    if (name === 'SETTINGS') return 'Mi cuenta (SETTINGS)';
    if (name === 'TABS') return 'Barra inferior de la app (TABS)';
    return name;
  }

  protected activeCount(sec: Section): number {
    return sec.items.filter((i) => i.isActive).length;
  }

  protected labelOf(it: AppMenuItem): string {
    return it.label?.['es'] || Object.values(it.label ?? {}).find((v) => !!v) || it.labelKey || it.code;
  }

  protected tableRoleName(id: number): string {
    return this.targets().roles.find((r) => r.id === id)?.name ?? `Rol #${id}`;
  }

  protected employeeTypeName(id: number): string {
    return this.targets().employeeRoleTypes.find((t) => t.id === id)?.name ?? `Rol de empleado #${id}`;
  }

  protected roleLabel(code: string): string {
    return this.roles().find((r) => r.code === code)?.label ?? code;
  }

  protected openForm(item?: AppMenuItem): void {
    const section = item?.section ?? 'SETTINGS';
    const sameSection = this.items().filter((i) => i.section === section);
    this.dialog
      .open<AppMenuFormComponent, AppMenuFormData, boolean>(AppMenuFormComponent, {
        width: '760px',
        maxWidth: '95vw',
        autoFocus: false,
        disableClose: true,
        data: {
          item,
          roles: this.roles(),
          targets: this.targets(),
          section,
          nextOrder: (Math.max(0, ...sameSection.map((i) => i.sortOrder)) || 0) + 10,
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => ok && this.load());
  }

  /** Sube/baja una opcion y renumera la seccion (10, 20, 30...) para que el orden quede limpio. */
  protected move(sec: Section, index: number, delta: number): void {
    const list = [...sec.items];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const changes = list
      .map((it, i) => ({ it, order: (i + 1) * 10 }))
      .filter(({ it, order }) => it.sortOrder !== order);
    if (!changes.length) return;

    this.busy.set(true);
    forkJoin(changes.map(({ it, order }) => this.service.update(it.id, { sortOrder: order })))
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.load(),
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo cambiar el orden', 'Cerrar', { duration: 5000 });
          this.load();
        },
      });
  }

  protected toggle(it: AppMenuItem, active: boolean): void {
    this.busy.set(true);
    this.service
      .update(it.id, { isActive: active })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(active ? `${this.labelOf(it)} visible en la app` : `${this.labelOf(it)} oculta en la app`, 'Cerrar', { duration: 3000 });
          this.load();
        },
        error: (err: Error) => {
          this.snackBar.open(err?.message || 'No se pudo cambiar', 'Cerrar', { duration: 5000 });
          this.load();
        },
      });
  }

  protected remove(it: AppMenuItem): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar opción',
        message: `Se quitará "${this.labelOf(it)}" del menú de la app. Si solo quiere ocultarla, desactívela.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#ef4444',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (!ok) return;
        this.service
          .remove(it.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open('Opción eliminada', 'Cerrar', { duration: 3000 });
              this.load();
            },
            error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo eliminar', 'Cerrar', { duration: 5000 }),
          });
      });
  }
}
