import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, filter, finalize, switchMap } from 'rxjs';

import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { AdminBonus, BONUS_KIND_LABELS, BONUS_STATUS_LABELS, BonusKind, BonusService, BonusStatus } from '../../services/bonus.service';
import { UserService } from '../../services/user.service';
import { PromotionService } from '../../services/promotion.service';
import { SubscriptionPlanOption } from '../../../../core/models/promotion.interface';
import { ProviderService } from '../../services/provider.service';
import { User } from '../../../../core/models/user.interface';
import { Provider } from '../../../../core/models/provider.interface';

interface BonusDraft {
  kind: BonusKind;
  /** Plan que se regala (bono de suscripción). */
  plan: string;
  provider: Provider | null;
  title: string;
  amount: number | null;
  forPerson: boolean;
  person: User | null;
  expires: boolean;
  expiresAt: string; // yyyy-MM-dd
}

/**
 * Panel → Promociones → Bonos: el admin regala bonos.
 *  - WALLET: saldo de FacilisTap a la billetera (sirve en toda la app). A una persona
 *    se le carga de una vez; con código, quien lo canjee lo recibe.
 *  - VERIFICATION: saldo para pagar la verificación de cuenta (si cubre todo, sale gratis).
 *  - SUBSCRIPTION: un plan regalado (1 mes, 6 meses, 1 año): se activa al canjearlo o al instante si es para alguien.
 *  - BUSINESS: bono de un negocio (solo sirve allí), igual al que crea el dueño.
 */
@Component({
  selector: 'app-bonus-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <div class="filters">
        <mat-button-toggle-group [value]="kindFilter()" (change)="setKindFilter($event.value)">
          <mat-button-toggle value="">Todos</mat-button-toggle>
          <mat-button-toggle value="WALLET"><mat-icon>account_balance_wallet</mat-icon> Billetera</mat-button-toggle>
          <mat-button-toggle value="SUBSCRIPTION"><mat-icon>workspace_premium</mat-icon> Suscripción</mat-button-toggle>
          <mat-button-toggle value="VERIFICATION"><mat-icon>verified</mat-icon> Verificación</mat-button-toggle>
          <mat-button-toggle value="BUSINESS"><mat-icon>storefront</mat-icon> De negocios</mat-button-toggle>
        </mat-button-toggle-group>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Buscar por código, nombre o negocio</mat-label>
          <input matInput [formControl]="search" />
        </mat-form-field>
      </div>
      @if (!formOpen()) {
        <button mat-flat-button color="primary" class="new-btn" (click)="startNew()"><mat-icon>redeem</mat-icon> Regalar bono</button>
      }
    </div>

    <!-- ═══════════ FORMULARIO ═══════════ -->
    @if (formOpen()) {
      <div class="form-grid">
        <div class="card form">
          <h3 class="card-title"><mat-icon>redeem</mat-icon> Regalar bono</h3>

          <section class="step">
            <h4><span class="num">1</span> ¿Qué tipo de bono?</h4>
            <mat-button-toggle-group [(ngModel)]="draft.kind">
              <mat-button-toggle value="WALLET"><mat-icon>account_balance_wallet</mat-icon> Saldo en billetera</mat-button-toggle>
              <mat-button-toggle value="SUBSCRIPTION"><mat-icon>workspace_premium</mat-icon> Suscripción</mat-button-toggle>
              <mat-button-toggle value="VERIFICATION"><mat-icon>verified</mat-icon> Para verificación</mat-button-toggle>
              <mat-button-toggle value="BUSINESS"><mat-icon>storefront</mat-icon> De un negocio</mat-button-toggle>
            </mat-button-toggle-group>
            <p class="hint">{{ kindHint() }}</p>
            @if (draft.kind === 'BUSINESS') {
              @if (draft.provider) {
                <div class="picked">
                  @if (draft.provider.logoUrl) { <img [src]="draft.provider.logoUrl" alt="" /> } @else { <mat-icon>storefront</mat-icon> }
                  <strong>{{ draft.provider.name }}</strong>
                  <button mat-button type="button" (click)="draft.provider = null">Cambiar</button>
                </div>
              } @else {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
                  <mat-label>Buscar negocio</mat-label>
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput [formControl]="providerSearch" [matAutocomplete]="provAuto" />
                  <mat-autocomplete #provAuto="matAutocomplete" (optionSelected)="pickProvider($event.option.value)">
                    @for (p of providerOptions(); track p.id) {
                      <mat-option [value]="p">{{ p.name }} <small class="muted">· {{ p.email }}</small></mat-option>
                    }
                  </mat-autocomplete>
                </mat-form-field>
              }
            }
          </section>

          <section class="step">
            <h4><span class="num">2</span> {{ draft.kind === 'SUBSCRIPTION' ? 'Nombre y plan' : 'Nombre y valor' }}</h4>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
              <mat-label>Nombre del bono</mat-label>
              <input matInput [(ngModel)]="draft.title" maxlength="80" placeholder="Ej: Bono de bienvenida" />
            </mat-form-field>
            @if (draft.kind === 'SUBSCRIPTION') {
              <div class="chips plans">
                @for (p of plans(); track p.code) {
                  <button type="button" class="chip" [class.on]="draft.plan === p.code" (click)="draft.plan = p.code">
                    <mat-icon>workspace_premium</mat-icon> {{ p.label }}
                  </button>
                }
              </div>
              <p class="hint">Se activa el plan completo, sin pagar. Si ya tiene suscripción, se le suman los días.</p>
            } @else {
            <div class="row">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="value-field">
                <mat-label>Valor</mat-label>
                <span matTextPrefix>$&nbsp;</span>
                <input matInput type="number" min="0" [(ngModel)]="draft.amount" />
              </mat-form-field>
              <div class="chips">
                @for (a of amountChips; track a) {
                  <button type="button" class="chip" [class.on]="draft.amount === a" (click)="draft.amount = a">{{ money(a) }}</button>
                }
              </div>
            </div>
            @if (draft.kind === 'WALLET') {
            }
            }
          </section>

          <section class="step">
            <h4><span class="num">3</span> ¿Para quién?</h4>
            <mat-button-toggle-group [(ngModel)]="draft.forPerson">
              <mat-button-toggle [value]="true"><mat-icon>person_search</mat-icon> Un usuario</mat-button-toggle>
              <mat-button-toggle [value]="false"><mat-icon>key</mat-icon> Código para compartir</mat-button-toggle>
            </mat-button-toggle-group>
            @if (draft.forPerson) {
              @if (draft.person) {
                <div class="picked">
                  <mat-icon>person</mat-icon>
                  <strong>{{ draft.person.name }} {{ draft.person.lastname }} <small class="muted">· {{ draft.person.email }}</small></strong>
                  <button mat-button type="button" (click)="draft.person = null">Cambiar</button>
                </div>
              } @else {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
                  <mat-label>Buscar usuario</mat-label>
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput [formControl]="userSearch" [matAutocomplete]="userAuto" placeholder="Nombre o email" />
                  <mat-autocomplete #userAuto="matAutocomplete" (optionSelected)="pickUser($event.option.value)">
                    @for (u of userOptions(); track u.id) {
                      <mat-option [value]="u">{{ u.name }} {{ u.lastname }} <small class="muted">· {{ u.email }}</small></mat-option>
                    }
                  </mat-autocomplete>
                </mat-form-field>
              }
              <p class="hint">
                {{ draft.kind === 'WALLET'
                  ? 'Se le carga de una vez a su billetera y le llega una notificación.'
                  : draft.kind === 'SUBSCRIPTION'
                    ? 'Se le activa la suscripción de una vez y le llega una notificación.'
                  : draft.kind === 'VERIFICATION'
                    ? 'Le llega una notificación y se le descuenta solo al pedir la verificación.'
                    : 'Solo esa persona lo puede usar y le llega el código en sus notificaciones.' }}
              </p>
            } @else {
              <p class="hint">Se genera un código de 8 caracteres; el primero que lo canjee se queda con el bono (una sola vez).</p>
            }
          </section>

          <section class="step">
            <h4><span class="num">4</span> ¿Vence?</h4>
            <div class="row">
              <mat-button-toggle-group [(ngModel)]="draft.expires">
                <mat-button-toggle [value]="false">No vence</mat-button-toggle>
                <mat-button-toggle [value]="true">Sí, tiene fecha</mat-button-toggle>
              </mat-button-toggle-group>
              @if (draft.expires) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Vence el</mat-label>
                  <input matInput type="date" [(ngModel)]="draft.expiresAt" [min]="today" />
                </mat-form-field>
              }
            </div>
            @if ((draft.kind === 'WALLET' || draft.kind === 'SUBSCRIPTION') && draft.forPerson) {
              <p class="hint">Se aplica de una vez, así que no vence: el vencimiento aplica al código sin canjear.</p>
            }
          </section>

          @if (formError(); as err) { <p class="error">{{ err }}</p> }
          <div class="actions">
            <button mat-stroked-button type="button" (click)="formOpen.set(false)">Cancelar</button>
            <button mat-flat-button color="primary" type="button" [disabled]="!!formError() || saving()" (click)="save()">
              @if (saving()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>redeem</mat-icon> }
              Regalar bono
            </button>
          </div>
        </div>

        <!-- Vista previa: la tarjeta de regalo -->
        <div class="card preview">
          <h3 class="card-title"><mat-icon>smartphone</mat-icon> Así lo verá el usuario</h3>
          <div class="gift" [class.wallet]="draft.kind === 'WALLET'" [class.verify]="draft.kind === 'VERIFICATION'" [class.sub]="draft.kind === 'SUBSCRIPTION'">
            <span class="gift-label"><mat-icon>{{ kindIcon(draft.kind) }}</mat-icon> {{ draft.title || 'Nombre del bono' }}</span>
            <strong class="gift-amount">{{ draft.kind === 'SUBSCRIPTION' ? planLabel(draft.plan) : money(draft.amount || 0) }}</strong>
            <small>{{ previewWhere() }}</small>
            <span class="gift-code">{{ draft.forPerson && (draft.kind === 'WALLET' || draft.kind === 'SUBSCRIPTION') ? 'Se aplica directo' : '••••••••' }}</span>
          </div>
        </div>
      </div>
    }

    <!-- ═══════════ LISTA ═══════════ -->
    @if (loading()) { <div class="center"><mat-spinner diameter="32"></mat-spinner></div> }
    @else if (!list().length) {
      <div class="empty card"><mat-icon>redeem</mat-icon><p>Aún no hay bonos.</p></div>
    } @else {
      <div class="list">
        @for (b of list(); track b.id) {
          <article class="card bonus" [ngClass]="'st-' + b.status">
            <div class="gift small" [class.wallet]="b.kind === 'WALLET'" [class.verify]="b.kind === 'VERIFICATION'" [class.sub]="b.kind === 'SUBSCRIPTION'">
              @if (b.kind === 'SUBSCRIPTION') {
                <strong class="gift-amount">{{ b.subscriptionPlanLabel }}</strong>
                <small>de suscripción</small>
              } @else {
                <strong class="gift-amount">{{ money(b.kind === 'WALLET' ? b.amount : b.balance) }}</strong>
                @if (b.kind !== 'WALLET') { <small>de {{ money(b.amount) }}</small> }
              }
            </div>
            <div class="bonus-main">
              <strong>{{ b.title }}
                <span class="tag" [class.wallet]="b.kind === 'WALLET'" [class.verify]="b.kind === 'VERIFICATION'" [class.sub]="b.kind === 'SUBSCRIPTION'">{{ kindLabel(b.kind) }}</span>
              </strong>
              @if (b.kind === 'BUSINESS') { <small><mat-icon>storefront</mat-icon> {{ b.providerName || 'Negocio' }}</small> }
              <small><mat-icon>person</mat-icon> {{ b.owner?.name || 'Cualquiera con el código' }}</small>
              <small><mat-icon>event</mat-icon> {{ b.expiresAt ? ('Vence ' + (b.expiresAt | date: 'd MMM y')) : 'No vence' }}</small>
            </div>
            <div class="bonus-side">
              <span class="status">{{ statusLabel(b.status, b.kind) }}</span>
              <button type="button" class="code" (click)="copy(b.code)" matTooltip="Copiar código">{{ b.code }} <mat-icon>content_copy</mat-icon></button>
              <div class="row-actions">
                @if (b.status !== 'CREDITED') {
                  <button mat-icon-button [matTooltip]="b.isActive ? 'Pausar' : 'Activar'" (click)="toggle(b)">
                    <mat-icon>{{ b.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
                  </button>
                }
                <button mat-icon-button matTooltip="Eliminar" class="danger" (click)="remove(b)"><mat-icon>delete</mat-icon></button>
              </div>
            </div>
          </article>
        }
      </div>
      <mat-paginator [length]="total()" [pageSize]="pageSize()" [pageIndex]="page()" [pageSizeOptions]="[10, 25, 50]" (page)="onPage($event)"></mat-paginator>
    }
  `,
  styles: [
    `
      .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
      .filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .search { width: 320px; max-width: 100%; }
      .new-btn { border-radius: 12px; height: 44px; display: inline-flex; align-items: center; gap: 6px; }
      .card { background: #fff; border-radius: 14px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); padding: 20px; }
      .card-title { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 16px; font-weight: 600; color: var(--fac-text);
        mat-icon { color: #db2777; } }
      .form-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 20px; align-items: start; margin: 18px 0 24px; }
      .preview { position: sticky; top: 16px; }
      .step { padding: 14px 0; border-bottom: 1px solid #eef1f6;
        h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #0f172a; } }
      .num { width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; background: linear-gradient(135deg, #7c3aed, #db2777); color: #fff; font-size: 12px; font-weight: 800; }
      .full { width: 100%; margin-top: 10px; }
      .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .value-field { width: 180px; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .plans .chip { display: inline-flex; align-items: center; gap: 6px; min-height: 42px; padding: 0 18px; font-size: 14px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      .chip { min-height: 34px; padding: 0 14px; border: 1.5px solid #e2e8f0; border-radius: 999px; background: #f8fafc; color: #334155;
        font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; &.on { border-color: #db2777; background: #fdf2f8; color: #be185d; } }
      .hint { margin: 8px 0 0; font-size: 12.5px; color: #64748b; }
      .muted { color: #94a3b8; font-size: 12px; }
      .error { margin: 12px 0 0; color: #dc2626; font-weight: 600; font-size: 13px; }
      .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;
        button { border-radius: 12px; height: 42px; display: inline-flex; align-items: center; gap: 6px; } }
      .picked { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 8px 12px; border-radius: 12px; background: #f8fafc;
        img { width: 36px; height: 36px; border-radius: 10px; object-fit: cover; } strong { flex: 1; } }
      .gift { display: flex; flex-direction: column; gap: 4px; padding: 18px; border-radius: 18px; color: #fff;
        background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
        &.wallet { background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); }
        &.verify { background: linear-gradient(135deg, #0b63f6 0%, #1494f3 55%, #00c6ff 100%); }
        &.sub { background: linear-gradient(135deg, #0f766e 0%, #10b981 100%); }
        &.small { padding: 12px; min-width: 120px; align-items: flex-start; }
        small { opacity: 0.92; font-size: 12px; } }
      .gift-label { display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 13px; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      .gift-amount { font-size: 28px; font-weight: 900; .small & { font-size: 20px; } }
      .gift-code { align-self: flex-start; margin-top: 6px; padding: 6px 12px; border: 1.5px dashed rgba(255, 255, 255, 0.7); border-radius: 10px;
        font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.15em; font-weight: 800; }
      .list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
      .bonus { display: flex; gap: 14px; align-items: center; padding: 14px 16px;
        &.st-USED_UP, &.st-EXPIRED, &.st-PAUSED { .gift { background: #cbd5e1; } } }
      .bonus-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;
        strong { font-size: 15px; color: #0f172a; display: flex; align-items: center; gap: 8px; }
        small { display: flex; align-items: center; gap: 4px; color: #64748b; font-size: 12.5px; mat-icon { font-size: 15px; width: 15px; height: 15px; } } }
      .tag { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #fdf2f8; color: #be185d;
        &.wallet { background: #fef3c7; color: #b45309; } &.verify { background: #e0f2fe; color: #0369a1; } &.sub { background: #dcfce7; color: #15803d; } }
      .bonus-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
      .status { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 800; background: #e2e8f0; color: #475569;
        .st-ACTIVE & { background: #dcfce7; color: #15803d; } .st-CREDITED & { background: #fef3c7; color: #b45309; }
        .st-UNCLAIMED & { background: #e0f2fe; color: #0369a1; } .st-PAUSED & { background: #fef3c7; color: #b45309; } }
      .code { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1.5px dashed #c4b5fd; border-radius: 10px;
        background: #f5f3ff; color: #6d28d9; font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 800; letter-spacing: 0.12em; cursor: pointer;
        mat-icon { font-size: 15px; width: 15px; height: 15px; } }
      .row-actions { display: flex; } .danger { color: #dc2626; }
      .empty { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 16px; color: #94a3b8;
        mat-icon { font-size: 36px; width: 36px; height: 36px; } p { margin: 0; } }
      .center { display: grid; place-items: center; padding: 32px; }
      @media (max-width: 1000px) { .form-grid { grid-template-columns: 1fr; } .preview { position: static; } }
    `,
  ],
})
export class BonusAdminComponent implements OnInit {
  private readonly api = inject(BonusService);
  private readonly userService = inject(UserService);
  private readonly promotionService = inject(PromotionService);
  /** Planes que se pueden regalar (los de la Tienda). */
  protected readonly plans = signal<SubscriptionPlanOption[]>([]);
  private readonly providerService = inject(ProviderService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly amountChips = [10000, 20000, 50000, 100000];
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected draft: BonusDraft = this.emptyDraft();

  protected readonly list = signal<AdminBonus[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly kindFilter = signal('');
  protected readonly search = new FormControl('', { nonNullable: true });

  protected readonly userSearch = new FormControl<string | User>('');
  protected readonly userOptions = signal<User[]>([]);
  protected readonly providerSearch = new FormControl<string | Provider>('');
  protected readonly providerOptions = signal<Provider[]>([]);

  ngOnInit(): void {
    this.promotionService.subscriptionPlans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (p) => this.plans.set(p) });
    this.load();
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
    this.userSearch.valueChanges
      .pipe(
        filter((v): v is string => typeof v === 'string'),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => this.userService.getAll({ page: 1, limit: 10, search: term.trim() || undefined })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (res) => this.userOptions.set(res.items ?? []) });
    this.providerSearch.valueChanges
      .pipe(
        filter((v): v is string => typeof v === 'string'),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.providerService.getAll({ page: 1, limit: 10, search: term.trim() || undefined })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: (res) => this.providerOptions.set(res.items ?? []) });
  }

  protected startNew(): void {
    this.draft = this.emptyDraft();
    this.formOpen.set(true);
  }

  protected setKindFilter(kind: string): void {
    this.kindFilter.set(kind);
    this.page.set(0);
    this.load();
  }

  protected pickProvider(p: Provider): void {
    this.draft.provider = p;
    this.providerSearch.setValue('');
  }

  protected pickUser(u: User): void {
    this.draft.person = u;
    this.userSearch.setValue('');
  }

  protected formError(): string | null {
    const d = this.draft;
    if (d.kind === 'BUSINESS' && !d.provider) return 'Elige el negocio.';
    if (!d.title.trim()) return 'Escribe un nombre para el bono.';
    if (d.kind === 'SUBSCRIPTION' && !d.plan) return 'Elige el plan que vas a regalar.';
    if (d.kind !== 'SUBSCRIPTION' && !(Number(d.amount) > 0)) return 'Escribe el valor del bono.';
    if (d.forPerson && !d.person) return 'Elige el usuario.';
    if (d.expires && (!d.expiresAt || d.expiresAt < this.today)) return 'Elige una fecha de vencimiento futura.';
    return null;
  }

  protected save(): void {
    if (this.saving() || this.formError()) return;
    const d = this.draft;
    this.saving.set(true);
    this.api
      .create({
        kind: d.kind,
        subscriptionPlan: d.kind === 'SUBSCRIPTION' ? d.plan : null,
        providerId: d.kind === 'BUSINESS' ? d.provider!.id : null,
        title: d.title.trim(),
        amount: Number(d.amount),
        recipientUserId: d.forPerson ? d.person!.id : null,
        expiresAt: d.expires ? new Date(`${d.expiresAt}T23:59:59`).toISOString() : null,
      })
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (b) => {
          this.formOpen.set(false);
          this.load();
          const who = b.owner?.name ?? 'el usuario';
          const msg = b.status !== 'CREDITED'
            ? `Bono creado · código ${b.code}`
            : b.kind === 'SUBSCRIPTION'
              ? `Se activó ${b.subscriptionPlanLabel} de suscripción a ${who}`
              : `Se cargaron ${this.money(b.amount)} a la billetera de ${who}`;
          this.snackBar.open(msg, b.status === 'CREDITED' ? 'Cerrar' : 'Copiar', { duration: 8000 })
            .onAction().subscribe(() => b.status !== 'CREDITED' && this.copy(b.code));
        },
        error: (err: Error) => this.snackBar.open(err?.message || 'No se pudo crear el bono', 'Cerrar', { duration: 5000 }),
      });
  }

  protected toggle(b: AdminBonus): void {
    this.api.update(b.id, { isActive: !b.isActive }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.load(),
      error: (e: Error) => this.snackBar.open(e?.message || 'No se pudo cambiar', 'Cerrar', { duration: 4000 }),
    });
  }

  protected remove(b: AdminBonus): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar bono',
        message: b.status === 'CREDITED'
          ? `"${b.title}" ya se aplicó: eliminarlo no quita el saldo ni la suscripción que ya recibió.`
          : `"${b.title}" (${b.code}) dejará de servir. Las agendas que ya lo usaron conservan su descuento.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#dc2626',
      })
      .pipe(filter(Boolean), switchMap(() => this.api.remove(b.id)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Bono eliminado', 'Cerrar', { duration: 3000 });
          this.load();
        },
        error: (e: Error) => this.snackBar.open(e?.message || 'No se pudo eliminar', 'Cerrar', { duration: 4000 }),
      });
  }

  protected copy(code: string): void {
    void navigator.clipboard?.writeText(code).then(
      () => this.snackBar.open(`Código ${code} copiado`, 'Cerrar', { duration: 2500 }),
      () => undefined,
    );
  }

  protected onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.load();
  }

  protected money(v: number): string {
    return '$' + (Number(v) || 0).toLocaleString('es-CO');
  }

  protected kindLabel(k: BonusKind): string {
    return BONUS_KIND_LABELS[k] ?? k;
  }

  protected kindHint(): string {
    if (this.draft.kind === 'SUBSCRIPTION') return 'Regala un plan de suscripción completo (1 mes, 6 meses o 1 año), sin pagar.';
    if (this.draft.kind === 'WALLET') return 'Sirve en toda la app: va a la Billetera del usuario y paga agendas de cualquier negocio.';
    if (this.draft.kind === 'VERIFICATION') {
      return 'Paga la verificación de su usuario o de su negocio. Si cubre todo el precio, la verificación sale gratis y pasa directo a revisión.';
    }
    return 'Solo sirve en ese negocio: se descuenta al agendar hasta que se acabe el saldo.';
  }

  protected previewWhere(): string {
    if (this.draft.kind === 'SUBSCRIPTION') return 'de suscripción · se activa sin pagar';
    if (this.draft.kind === 'WALLET') return 'En tu billetera · sirve en toda la app';
    if (this.draft.kind === 'VERIFICATION') return 'Para verificar tu cuenta · Tienda → Verificación';
    return this.draft.provider?.name || 'Negocio';
  }

  protected statusLabel(s: BonusStatus, kind?: BonusKind): string {
    if (s === 'CREDITED' && kind === 'SUBSCRIPTION') return 'Suscripción activada';
    return BONUS_STATUS_LABELS[s] ?? s;
  }

  protected kindIcon(k: BonusKind): string {
    return k === 'VERIFICATION' ? 'verified' : k === 'SUBSCRIPTION' ? 'workspace_premium' : 'redeem';
  }

  protected planLabel(code: string): string {
    return this.plans().find((p) => p.code === code)?.label ?? 'Elige un plan';
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .list(this.page() + 1, this.pageSize(), this.search.value.trim(), this.kindFilter())
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.list.set(res.items ?? []);
          this.total.set(res.total ?? 0);
        },
      });
  }

  private emptyDraft(): BonusDraft {
    return { kind: 'WALLET', plan: 'MONTHLY', provider: null, title: '', amount: null, forPerson: true, person: null, expires: false, expiresAt: '' };
  }
}
