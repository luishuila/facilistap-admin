import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, filter, finalize, switchMap } from 'rxjs';

import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { BonusAdminComponent } from './bonus-admin.component';
import { PromotionService } from '../../services/promotion.service';
import { UserService } from '../../services/user.service';
import { ProviderService } from '../../services/provider.service';
import { User } from '../../../../core/models/user.interface';
import { Provider } from '../../../../core/models/provider.interface';
import {
  BUSINESS_AUDIENCE_LABELS,
  BusinessAudience,
  BusinessPromotion,
  BusinessScope,
  DiscountType,
  PromotionCatalogItem,
  PromotionStatus,
  PromotionUser,
  STATUS_LABELS,
  StoreProduct,
  SubscriptionPlanOption,
  SubscriptionPromotion,
  VERIFICATION_TARGETS,
} from '../../../../core/models/promotion.interface';

type Tab = 'subscription' | 'business' | 'bonus';
const TABS: Tab[] = ['subscription', 'business', 'bonus'];

/** Formulario común de las dos promociones (lo que no aplica a una se ignora). */
interface Draft {
  id: number | null;
  title: string;
  discountType: DiscountType;
  discountValue: number | null;
  startsAt: string; // yyyy-MM-ddTHH:mm (hora local)
  endsAt: string;
  limited: boolean;
  maxUses: number | null;
  /** Veces por persona (empieza en 1); null = sin límite. */
  perUser: number | null;
  users: PromotionUser[];
  // Tienda (suscripción o verificación)
  product: StoreProduct;
  plans: string[];
  subAudience: 'EVERYONE' | 'SELECTED';
  // Citas
  provider: Provider | null;
  scope: BusinessScope;
  serviceIds: number[];
  subcategoryIds: number[];
  audience: BusinessAudience;
}

const MAX_USERS = 500;

@Component({
  selector: 'app-promotion-admin',
  standalone: true,
  imports: [
    BonusAdminComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatChipsModule,
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
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Promociones</h1>
          <p class="page-subtitle">
            Descuentos en la Tienda (planes y verificación) o en las agendas de un negocio, y bonos de regalo (saldo en billetera o de un negocio), para todos o para usuarios específicos.
            Se aplican solos y a los usuarios elegidos les llega una notificación.
          </p>
        </div>
        @if (!formOpen() && tab() !== 'bonus') {
          <button mat-flat-button color="primary" class="new-btn" (click)="startNew()">
            <mat-icon>add</mat-icon> Nueva promoción
          </button>
        }
      </div>

      <mat-tab-group [selectedIndex]="tabIndex()" (selectedIndexChange)="setTab(tabs[$event])" animationDuration="0ms">
        <mat-tab><ng-template mat-tab-label><mat-icon class="tab-icon">storefront</mat-icon> Tienda (planes y verificación)</ng-template></mat-tab>
        <mat-tab><ng-template mat-tab-label><mat-icon class="tab-icon">event_available</mat-icon> Agendas de negocios</ng-template></mat-tab>
        <mat-tab><ng-template mat-tab-label><mat-icon class="tab-icon">redeem</mat-icon> Bonos</ng-template></mat-tab>
      </mat-tab-group>

      @if (tab() === 'bonus') {
        <!-- Bonos: el admin regala saldo (billetera de FacilisTap) o bonos de un negocio -->
        <app-bonus-admin />
      }

      <!-- ═══════════ FORMULARIO ═══════════ -->
      @if (formOpen() && tab() !== 'bonus') {
        <div class="form-grid">
          <div class="card form">
            <h3 class="card-title">
              <mat-icon>{{ tab() === 'subscription' ? 'workspace_premium' : 'event_available' }}</mat-icon>
              {{ draft.id ? 'Editar promoción' : (tab() === 'subscription' ? 'Nueva promoción de la Tienda' : 'Nueva promoción de agendas') }}
            </h3>

            <!-- Agendas: primero el negocio -->
            @if (tab() === 'business') {
              <section class="step">
                <h4><span class="num">1</span> Negocio</h4>
                @if (draft.provider) {
                  <div class="picked-provider">
                    @if (draft.provider.logoUrl) { <img [src]="draft.provider.logoUrl" alt="" /> } @else { <mat-icon>storefront</mat-icon> }
                    <strong>{{ draft.provider.name }}</strong>
                    @if (!draft.id) {
                      <button mat-button type="button" (click)="clearProvider()">Cambiar</button>
                    }
                  </div>
                } @else {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
                    <mat-label>Buscar negocio</mat-label>
                    <mat-icon matPrefix>search</mat-icon>
                    <input matInput [formControl]="providerSearch" [matAutocomplete]="provAuto" placeholder="Nombre o @usuario del negocio" />
                    <mat-autocomplete #provAuto="matAutocomplete" (optionSelected)="pickProvider($event.option.value)">
                      @for (p of providerOptions(); track p.id) {
                        <mat-option [value]="p">{{ p.name }} <small class="muted">· {{ p.email }}</small></mat-option>
                      }
                    </mat-autocomplete>
                  </mat-form-field>
                }
              </section>
            }

            <section class="step">
              <h4><span class="num">{{ n(1) }}</span> Nombre</h4>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
                <mat-label>Título de la promoción</mat-label>
                <input matInput [(ngModel)]="draft.title" maxlength="80" [placeholder]="tab() === 'subscription' ? 'Ej: Black Friday 20% en tu plan' : 'Ej: Semana del corte'" />
              </mat-form-field>
            </section>

            <section class="step">
              <h4><span class="num">{{ n(2) }}</span> ¿Cuánto descuento?</h4>
              <div class="row">
                <mat-button-toggle-group [(ngModel)]="draft.discountType" (change)="draft.discountValue = null">
                  <mat-button-toggle value="PERCENT"><mat-icon>percent</mat-icon> Porcentaje</mat-button-toggle>
                  <mat-button-toggle value="AMOUNT"><mat-icon>payments</mat-icon> Valor fijo</mat-button-toggle>
                </mat-button-toggle-group>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="value-field">
                  <mat-label>{{ draft.discountType === 'PERCENT' ? 'Porcentaje' : 'Valor' }}</mat-label>
                  @if (draft.discountType === 'AMOUNT') { <span matTextPrefix>$&nbsp;</span> }
                  <input matInput type="number" min="0" [(ngModel)]="draft.discountValue" />
                  @if (draft.discountType === 'PERCENT') { <span matTextSuffix>%</span> }
                </mat-form-field>
              </div>
              @if (draft.discountType === 'PERCENT') {
                <div class="chips">
                  @for (c of percentChips; track c) {
                    <button type="button" class="chip" [class.on]="draft.discountValue === c" (click)="draft.discountValue = c">{{ c }}%</button>
                  }
                </div>
              }
            </section>

            <!-- Tienda: qué producto y qué planes / qué verificación -->
            @if (tab() === 'subscription') {
              <section class="step">
                <h4><span class="num">{{ n(3) }}</span> ¿Qué producto?</h4>
                <mat-button-toggle-group [(ngModel)]="draft.product" (change)="draft.plans = []" [disabled]="!!draft.id">
                  <mat-button-toggle value="SUBSCRIPTION"><mat-icon>workspace_premium</mat-icon> Suscripción</mat-button-toggle>
                  <mat-button-toggle value="VERIFICATION"><mat-icon>verified</mat-icon> Verificación de cuenta</mat-button-toggle>
                </mat-button-toggle-group>
                <div class="chips">
                  <button type="button" class="chip" [class.on]="!draft.plans.length" (click)="draft.plans = []">
                    {{ draft.product === 'VERIFICATION' ? 'Usuario y negocio' : 'Todos los planes' }}
                  </button>
                  @for (p of productOptions(); track p.code) {
                    <button type="button" class="chip" [class.on]="draft.plans.includes(p.code)" (click)="togglePlan(p.code)">{{ p.label }}</button>
                  }
                </div>
              </section>
            } @else {
              <!-- Agendas: qué servicios -->
              <section class="step">
                <h4><span class="num">{{ n(3) }}</span> ¿En qué servicios?</h4>
                <mat-button-toggle-group [(ngModel)]="draft.scope">
                  <mat-button-toggle value="ALL">Todos</mat-button-toggle>
                  <mat-button-toggle value="SERVICES" [disabled]="!catalog().length">Elegir servicios</mat-button-toggle>
                  <mat-button-toggle value="CATEGORIES" [disabled]="!categories().length">Por categoría</mat-button-toggle>
                </mat-button-toggle-group>
                @if (!draft.provider) {
                  <p class="hint">Primero elige el negocio para ver sus servicios.</p>
                } @else if (catalogLoading()) {
                  <mat-spinner diameter="22"></mat-spinner>
                } @else if (draft.scope === 'SERVICES') {
                  <div class="chips">
                    @for (s of catalog(); track s.id) {
                      <button type="button" class="chip" [class.on]="draft.serviceIds.includes(s.id)" (click)="toggleId(draft.serviceIds, s.id)">
                        {{ s.name }} <em>{{ money(s.price) }}</em>
                      </button>
                    }
                  </div>
                } @else if (draft.scope === 'CATEGORIES') {
                  <div class="chips">
                    @for (c of categories(); track c.id) {
                      <button type="button" class="chip" [class.on]="draft.subcategoryIds.includes(c.id)" (click)="toggleId(draft.subcategoryIds, c.id)">
                        {{ c.name }} <em>{{ c.count }}</em>
                      </button>
                    }
                  </div>
                } @else if (!catalog().length) {
                  <p class="hint">Este negocio aún no tiene servicios.</p>
                }
              </section>
            }

            <section class="step">
              <h4><span class="num">{{ n(4) }}</span> ¿Cuándo aplica?</h4>
              <div class="chips">
                <button type="button" class="chip" (click)="setDuration(1)">Solo hoy</button>
                <button type="button" class="chip" (click)="setDuration(3)">3 días</button>
                <button type="button" class="chip" (click)="setDuration(7)">7 días</button>
                <button type="button" class="chip" (click)="setDuration(15)">15 días</button>
                <button type="button" class="chip" (click)="setDuration(30)">30 días</button>
              </div>
              <div class="row dates">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Desde</mat-label>
                  <input matInput type="datetime-local" [(ngModel)]="draft.startsAt" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Hasta</mat-label>
                  <input matInput type="datetime-local" [(ngModel)]="draft.endsAt" [min]="draft.startsAt" />
                </mat-form-field>
              </div>
            </section>

            <section class="step">
              <h4><span class="num">{{ n(5) }}</span> ¿Cuántos pueden usarla?</h4>
              <div class="row">
                <mat-button-toggle-group [(ngModel)]="draft.limited" (change)="!draft.maxUses && (draft.maxUses = 50)">
                  <mat-button-toggle [value]="false"><mat-icon>all_inclusive</mat-icon> Sin límite</mat-button-toggle>
                  <mat-button-toggle [value]="true"><mat-icon>group</mat-icon> Solo los primeros</mat-button-toggle>
                </mat-button-toggle-group>
                @if (draft.limited) {
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="value-field">
                    <mat-label>{{ tab() === 'subscription' ? 'Usuarios' : 'Agendas' }}</mat-label>
                    <input matInput type="number" min="1" [(ngModel)]="draft.maxUses" />
                  </mat-form-field>
                }
              </div>
              @if (draft.limited) {
                <div class="chips">
                  @for (c of usesChips; track c) {
                    <button type="button" class="chip" [class.on]="draft.maxUses === c" (click)="draft.maxUses = c">{{ c }}</button>
                  }
                </div>
              }

              <!-- Veces por persona: al usarla (agenda creada o pago aprobado) se gasta; al llegar al límite ya no le aplica -->
              <div class="per-user">
                <span class="per-user-label"><mat-icon>person</mat-icon> ¿Cuántas veces puede usarla cada persona?</span>
                <div class="chips">
                  @for (c of perUserChips; track c) {
                    <button type="button" class="chip" [class.on]="draft.perUser === c" (click)="draft.perUser = c">{{ c }} {{ c === 1 ? 'vez' : 'veces' }}</button>
                  }
                  <button type="button" class="chip" [class.on]="draft.perUser === null" (click)="draft.perUser = null">Sin límite</button>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="per-user-field">
                    <mat-label>Otro</mat-label>
                    <input matInput type="number" min="1" [ngModel]="draft.perUser" (ngModelChange)="draft.perUser = $event === '' || $event == null ? null : $event" />
                  </mat-form-field>
                </div>
                <p class="hint">
                  {{ tab() === 'subscription'
                    ? 'Cada pago aprobado con la promoción gasta un uso.'
                    : 'Cada agenda creada con la promoción gasta un uso (si la cancela, lo recupera).' }}
                  Al llegar al límite, ya no le aplica.
                </p>
              </div>
            </section>

            <section class="step">
              <h4><span class="num">{{ n(6) }}</span> ¿Para quién?</h4>
              @if (tab() === 'subscription') {
                <mat-button-toggle-group [(ngModel)]="draft.subAudience">
                  <mat-button-toggle value="EVERYONE"><mat-icon>public</mat-icon> Todos los usuarios</mat-button-toggle>
                  <mat-button-toggle value="SELECTED"><mat-icon>person_search</mat-icon> Usuarios específicos</mat-button-toggle>
                </mat-button-toggle-group>
              } @else {
                <div class="chips">
                  @for (a of businessAudiences; track a.value) {
                    <button type="button" class="chip" [class.on]="draft.audience === a.value" (click)="draft.audience = a.value">{{ a.label }}</button>
                  }
                </div>
              }

              @if (needsUsers()) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full users-field">
                  <mat-label>Usuarios ({{ draft.users.length }})</mat-label>
                  <mat-chip-grid #chipGrid>
                    @for (u of draft.users; track u.id) {
                      <mat-chip-row (removed)="removeUser(u)">
                        {{ u.name }}
                        <button matChipRemove type="button"><mat-icon>cancel</mat-icon></button>
                      </mat-chip-row>
                    }
                    <input placeholder="Buscar por nombre o email" [formControl]="userSearch" [matAutocomplete]="userAuto" [matChipInputFor]="chipGrid" />
                  </mat-chip-grid>
                  <mat-autocomplete #userAuto="matAutocomplete" (optionSelected)="addUser($event.option.value)">
                    @for (u of userOptions(); track u.id) {
                      <mat-option [value]="u">{{ u.name }} {{ u.lastname }} <small class="muted">· {{ u.email }}</small></mat-option>
                    }
                  </mat-autocomplete>
                </mat-form-field>
                <p class="hint">Les llega una notificación. Máximo {{ maxUsers }} usuarios; para más, usa {{ tab() === 'subscription' ? '"Todos los usuarios"' : 'un grupo del negocio' }}.</p>
              } @else if (tab() === 'business' && draft.audience !== 'EVERYONE') {
                <p class="hint">A todo ese grupo del negocio le llega una notificación.</p>
              } @else {
                <p class="hint">Aplica a cualquiera; no se envía notificación (puedes anunciarla desde Notificaciones).</p>
              }
            </section>

            @if (formError(); as err) { <p class="error">{{ err }}</p> }

            <div class="actions">
              <button mat-stroked-button type="button" (click)="closeForm()">Cancelar</button>
              <button mat-flat-button color="primary" type="button" [disabled]="!!formError() || saving()" (click)="save()">
                @if (saving()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>check</mat-icon> }
                {{ draft.id ? 'Guardar cambios' : 'Publicar promoción' }}
              </button>
            </div>
          </div>

          <!-- Vista previa -->
          <div class="card preview">
            <h3 class="card-title"><mat-icon>smartphone</mat-icon> Así lo verá el usuario</h3>
            <div class="promo-preview" [class.for-you]="needsUsers()">
              <span class="badge">{{ discountLabel(draft.discountType, draft.discountValue) }}</span>
              <div>
                <strong>{{ previewTitle() }}</strong>
                <p>{{ draft.title || 'Título de la promoción' }}</p>
                <p class="small">{{ previewScope() }}</p>
                @if (draft.endsAt) { <p class="small">Válida hasta {{ draft.endsAt | date: 'd MMM, h:mm a' }}</p> }
                @if (draft.limited && draft.maxUses) { <p class="small">Solo para los primeros {{ draft.maxUses }}</p> }
                @if (draft.perUser != null) { <p class="small">Úsala {{ draft.perUser }} {{ draft.perUser === 1 ? 'vez' : 'veces' }}</p> }
              </div>
            </div>
            @if (tab() === 'subscription') {
              <p class="hint">
                En la Tienda {{ draft.product === 'VERIFICATION' ? 'la verificación' : 'el plan' }} sale con el precio tachado y el nuevo;
                el cobro usa el precio con descuento. Cada usuario la usa una vez.
              </p>
            } @else {
              <p class="hint">En el perfil del negocio y en la tarjeta del servicio; el descuento se aplica al agendar.</p>
            }
          </div>
        </div>
      }

      <!-- ═══════════ LISTAS ═══════════ -->
      @if (tab() === 'subscription') {
        @if (subLoading()) { <div class="center"><mat-spinner diameter="32"></mat-spinner></div> }
        @else if (!subscriptionList().length) {
          <div class="empty card"><mat-icon>storefront</mat-icon><p>Aún no hay promociones de la Tienda.</p></div>
        } @else {
          <div class="list">
            @for (p of subscriptionList(); track p.id) {
              <article class="card promo" [ngClass]="'st-' + p.status">
                <span class="badge">{{ p.label }}</span>
                <div class="promo-main">
                  <strong>{{ p.title }}
                    <span class="tag-product" [class.verify]="p.product === 'VERIFICATION'">
                      {{ p.product === 'VERIFICATION' ? 'Verificación' : 'Suscripción' }}
                    </span>
                  </strong>
                  <small><mat-icon>sell</mat-icon> {{ planLabels(p.plans, p.product) }}</small>
                  <small><mat-icon>group</mat-icon> {{ p.audience === 'SELECTED' ? (p.users?.length || p.userIds.length) + ' usuarios específicos' : 'Todos los usuarios' }}</small>
                  <small><mat-icon>event</mat-icon> {{ p.startsAt | date: 'd MMM y, h:mm a' }} → {{ p.endsAt | date: 'd MMM y, h:mm a' }}</small>
                </div>
                <div class="promo-side">
                  <span class="status">{{ statusLabel(p.status) }}</span>
                  <span class="uses">{{ p.usedCount }}{{ p.maxUses ? ' / ' + p.maxUses : '' }} usos</span>
                  <span class="uses">{{ p.maxUsesPerUser == null ? 'Sin límite por persona' : p.maxUsesPerUser + (p.maxUsesPerUser === 1 ? ' vez' : ' veces') + ' por persona' }}</span>
                  <div class="row-actions">
                    <button mat-icon-button matTooltip="Editar" (click)="editSubscription(p)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button [matTooltip]="p.isActive ? 'Pausar' : 'Activar'" (click)="toggleSubscription(p)">
                      <mat-icon>{{ p.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Eliminar" class="danger" (click)="removeSubscription(p)"><mat-icon>delete</mat-icon></button>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      } @else if (tab() === 'business') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Buscar por promoción o negocio</mat-label>
          <input matInput [formControl]="businessSearch" />
        </mat-form-field>
        @if (bizLoading()) { <div class="center"><mat-spinner diameter="32"></mat-spinner></div> }
        @else if (!businessList().length) {
          <div class="empty card"><mat-icon>event_available</mat-icon><p>No hay promociones de agendas.</p></div>
        } @else {
          <div class="list">
            @for (p of businessList(); track p.id) {
              <article class="card promo" [ngClass]="'st-' + p.status">
                <span class="badge">{{ discountLabel(p.discountType, p.discountValue) }}</span>
                <div class="promo-main">
                  <strong>{{ p.title }}
                    @if (p.createdByAdmin) { <span class="tag-admin">FacilisTap</span> }
                  </strong>
                  <small><mat-icon>storefront</mat-icon> {{ p.provider?.name || 'Negocio' }}</small>
                  <small><mat-icon>group</mat-icon> {{ p.audience === 'SELECTED' ? (p.users?.length || p.userIds.length) + ' usuarios específicos' : audienceLabel(p.audience) }}</small>
                  <small><mat-icon>event</mat-icon> {{ p.startsAt | date: 'd MMM y, h:mm a' }} → {{ p.endsAt | date: 'd MMM y, h:mm a' }}</small>
                </div>
                <div class="promo-side">
                  <span class="status">{{ statusLabel(p.status) }}</span>
                  <span class="uses">{{ p.usedCount }}{{ p.maxUses ? ' / ' + p.maxUses : '' }} agendas</span>
                  <span class="uses">{{ p.maxUsesPerUser == null ? 'Sin límite por persona' : p.maxUsesPerUser + (p.maxUsesPerUser === 1 ? ' vez' : ' veces') + ' por persona' }}</span>
                  <div class="row-actions">
                    <button mat-icon-button matTooltip="Editar" (click)="editBusiness(p)"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button [matTooltip]="p.isActive ? 'Pausar' : 'Activar'" (click)="toggleBusiness(p)">
                      <mat-icon>{{ p.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Eliminar" class="danger" (click)="removeBusiness(p)"><mat-icon>delete</mat-icon></button>
                  </div>
                </div>
              </article>
            }
          </div>
          <mat-paginator [length]="bizTotal()" [pageSize]="bizPageSize()" [pageIndex]="bizPage()" [pageSizeOptions]="[10, 25, 50]" (page)="onBizPage($event)"></mat-paginator>
        }
      }
    </div>
  `,
  styles: [
    `
      .page { padding: 24px; max-width: 1400px; margin: 0 auto; }
      .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
      .page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--fac-text); }
      .page-subtitle { margin: 4px 0 0; font-size: 14px; color: var(--fac-text-muted); max-width: 760px; }
      .new-btn { border-radius: 12px; height: 44px; display: inline-flex; align-items: center; gap: 6px; }
      .tab-icon { margin-right: 6px; }
      .card { background: #fff; border-radius: 14px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); padding: 20px; }
      .card-title { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 16px; font-weight: 600; color: var(--fac-text);
        mat-icon { color: var(--fac-primary-shade); } }
      .form-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 20px; align-items: start; margin: 18px 0 24px; }
      .preview { position: sticky; top: 16px; }
      .step { padding: 14px 0; border-bottom: 1px solid #eef1f6;
        h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #0f172a; } }
      .num { width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; background: var(--fac-gradient, #1daeff); color: #fff; font-size: 12px; font-weight: 800; }
      .full { width: 100%; }
      .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .dates mat-form-field { flex: 1 1 220px; }
      .value-field { width: 160px; }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .chip { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 14px; border: 1.5px solid #e2e8f0; border-radius: 999px;
        background: #f8fafc; color: #334155; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
        em { font-style: normal; color: #94a3b8; font-size: 12px; }
        &.on { border-color: #2f6bff; background: #eef4ff; color: #1d4ed8; } }
      .hint { margin: 8px 0 0; font-size: 12.5px; color: #64748b; }
      .muted { color: #94a3b8; font-size: 12px; }
      .error { margin: 12px 0 0; color: #dc2626; font-weight: 600; font-size: 13px; }
      .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;
        button { border-radius: 12px; height: 42px; display: inline-flex; align-items: center; gap: 6px; } }
      .picked-provider { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; background: #f8fafc;
        img { width: 36px; height: 36px; border-radius: 10px; object-fit: cover; } strong { flex: 1; } }
      .promo-preview { display: flex; gap: 12px; padding: 14px; border-radius: 16px; background: #fff7ed; border: 1.5px dashed #fdba74;
        strong { display: block; font-size: 14px; color: #0f172a; } p { margin: 3px 0 0; font-size: 13px; color: #9a3412; } .small { font-size: 12px; }
        &.for-you { background: #f5f3ff; border-color: #c4b5fd; p { color: #6d28d9; } .badge { background: linear-gradient(135deg, #7c3aed, #db2777); } } }
      .badge { flex: 0 0 auto; align-self: flex-start; min-width: 58px; padding: 10px 8px; border-radius: 14px; text-align: center; color: #fff; font-weight: 900;
        background: linear-gradient(135deg, #f59e0b, #f97316); }
      .list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
      .promo { display: flex; gap: 14px; align-items: center; padding: 14px 16px;
        &.st-ENDED, &.st-PAUSED, &.st-SOLD_OUT { .badge { background: #cbd5e1; } } }
      .promo-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;
        strong { font-size: 15px; color: #0f172a; display: flex; align-items: center; gap: 8px; }
        small { display: flex; align-items: center; gap: 4px; color: #64748b; font-size: 12.5px; mat-icon { font-size: 15px; width: 15px; height: 15px; } } }
      .per-user { margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e2e8f0; }
      .per-user-label { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: #334155;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--fac-primary-shade); } }
      .per-user-field { width: 110px; }
      .tag-product { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #fef3c7; color: #b45309;
        &.verify { background: #dcfce7; color: #15803d; } }
      .tag-admin { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: #e0f2fe; color: #0369a1; }
      .promo-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
      .status { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 800; background: #e2e8f0; color: #475569;
        .st-ACTIVE & { background: #dcfce7; color: #15803d; } .st-SCHEDULED & { background: #e0f2fe; color: #0369a1; }
        .st-PAUSED & { background: #fef3c7; color: #b45309; } .st-SOLD_OUT & { background: #fee2e2; color: #b91c1c; } }
      .uses { font-size: 12px; color: #64748b; font-weight: 600; }
      .row-actions { display: flex; } .danger { color: #dc2626; }
      .search { width: 100%; max-width: 420px; margin-top: 16px; }
      .empty { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 16px; color: #94a3b8;
        mat-icon { font-size: 36px; width: 36px; height: 36px; } p { margin: 0; } }
      .center { display: grid; place-items: center; padding: 32px; }
      @media (max-width: 1000px) { .form-grid { grid-template-columns: 1fr; } .preview { position: static; } }
    `,
  ],
})
export class PromotionAdminComponent implements OnInit {
  private readonly api = inject(PromotionService);
  private readonly userService = inject(UserService);
  private readonly providerService = inject(ProviderService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxUsers = MAX_USERS;
  protected readonly percentChips = [5, 10, 15, 20, 30, 50];
  protected readonly usesChips = [10, 50, 100, 500];
  protected readonly perUserChips = [1, 2, 3, 5];
  protected readonly businessAudiences = (Object.keys(BUSINESS_AUDIENCE_LABELS) as BusinessAudience[]).map((value) => ({
    value,
    label: BUSINESS_AUDIENCE_LABELS[value],
  }));

  protected readonly tab = signal<Tab>('subscription');
  protected readonly tabs = TABS;
  protected tabIndex(): number {
    return TABS.indexOf(this.tab());
  }
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected draft: Draft = this.emptyDraft();

  // Suscripción
  protected readonly plans = signal<SubscriptionPlanOption[]>([]);
  protected readonly subscriptionList = signal<SubscriptionPromotion[]>([]);
  protected readonly subLoading = signal(false);

  // Citas
  protected readonly businessList = signal<BusinessPromotion[]>([]);
  protected readonly bizLoading = signal(false);
  protected readonly bizTotal = signal(0);
  protected readonly bizPage = signal(0);
  protected readonly bizPageSize = signal(10);
  protected readonly businessSearch = new FormControl('', { nonNullable: true });
  protected readonly catalog = signal<PromotionCatalogItem[]>([]);
  protected readonly catalogLoading = signal(false);
  protected readonly categories = computed(() => {
    const map = new Map<number, { id: number; name: string; count: number }>();
    for (const s of this.catalog()) {
      if (s.subcategoryId == null) continue;
      const c = map.get(s.subcategoryId) ?? { id: s.subcategoryId, name: s.subcategoryName || '—', count: 0 };
      c.count++;
      map.set(s.subcategoryId, c);
    }
    return Array.from(map.values());
  });

  // Buscadores
  protected readonly userSearch = new FormControl<string | User>('');
  protected readonly userOptions = signal<User[]>([]);
  protected readonly providerSearch = new FormControl<string | Provider>('');
  protected readonly providerOptions = signal<Provider[]>([]);

  ngOnInit(): void {
    this.api.subscriptionPlans().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (p) => this.plans.set(p) });
    this.loadSubscription();

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

    this.businessSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.bizPage.set(0);
        this.loadBusiness();
      });
  }

  // ─── Navegación ───

  protected setTab(tab: Tab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.closeForm();
    if (tab === 'business' && !this.businessList().length) this.loadBusiness();
  }

  /** Número del paso: en citas el 1 es el negocio. */
  protected n(step: number): number {
    return this.tab() === 'business' ? step + 1 : step;
  }

  protected startNew(): void {
    this.draft = this.emptyDraft();
    this.catalog.set([]);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.draft = this.emptyDraft();
  }

  // ─── Formulario ───

  /** Chips del paso 3: los planes o qué se verifica. */
  protected productOptions(): SubscriptionPlanOption[] {
    return this.draft.product === 'VERIFICATION' ? VERIFICATION_TARGETS : this.plans();
  }

  protected previewTitle(): string {
    if (this.needsUsers()) return '🎁 Tienes una promoción para ti';
    if (this.tab() === 'business') return '🔥 ¡Estamos en promoción!';
    return this.draft.product === 'VERIFICATION' ? '🔥 Verificación en promoción' : '🔥 ¡Planes en promoción!';
  }

  protected togglePlan(code: string): void {
    this.draft.plans = this.draft.plans.includes(code)
      ? this.draft.plans.filter((c) => c !== code)
      : [...this.draft.plans, code];
  }

  protected toggleId(list: number[], id: number): void {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
  }

  protected setDuration(days: number): void {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days - 1);
    end.setHours(23, 59, 0, 0);
    this.draft.startsAt = toLocalInput(now);
    this.draft.endsAt = toLocalInput(end);
  }

  protected pickProvider(p: Provider): void {
    this.draft.provider = p;
    this.providerSearch.setValue('');
    this.loadCatalog(p.id);
  }

  protected clearProvider(): void {
    this.draft.provider = null;
    this.draft.scope = 'ALL';
    this.draft.serviceIds = [];
    this.draft.subcategoryIds = [];
    this.catalog.set([]);
  }

  private loadCatalog(providerId: number): void {
    this.catalogLoading.set(true);
    this.api
      .catalog(providerId)
      .pipe(finalize(() => this.catalogLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.catalog.set(c), error: () => this.catalog.set([]) });
  }

  protected addUser(user: User): void {
    if (this.draft.users.length >= MAX_USERS) {
      this.snackBar.open(`Máximo ${MAX_USERS} usuarios`, 'Cerrar', { duration: 4000 });
    } else if (!this.draft.users.some((u) => u.id === user.id)) {
      const name = [user.name, user.lastname].filter(Boolean).join(' ').trim() || user.email || '—';
      this.draft.users = [...this.draft.users, { id: user.id, name, email: user.email, img: user.img }];
    }
    this.userSearch.setValue('');
  }

  protected removeUser(user: PromotionUser): void {
    this.draft.users = this.draft.users.filter((u) => u.id !== user.id);
  }

  protected needsUsers(): boolean {
    return this.tab() === 'subscription' ? this.draft.subAudience === 'SELECTED' : this.draft.audience === 'SELECTED';
  }

  protected formError(): string | null {
    const d = this.draft;
    const value = Number(d.discountValue);
    if (this.tab() === 'business' && !d.provider) return 'Elige el negocio.';
    if (!d.title.trim()) return 'Escribe un título.';
    if (!(value > 0)) return 'Escribe cuánto descuento.';
    if (d.discountType === 'PERCENT' && value >= (this.tab() === 'subscription' ? 100 : 101)) {
      return this.tab() === 'subscription' ? 'El porcentaje debe ser menor que 100%.' : 'El porcentaje no puede pasar de 100%.';
    }
    if (this.tab() === 'business' && d.scope === 'SERVICES' && !d.serviceIds.length) return 'Elige al menos un servicio.';
    if (this.tab() === 'business' && d.scope === 'CATEGORIES' && !d.subcategoryIds.length) return 'Elige al menos una categoría.';
    if (!d.startsAt || !d.endsAt) return 'Elige desde y hasta cuándo.';
    if (new Date(d.endsAt) <= new Date(d.startsAt)) return 'La fecha de fin debe ser después del inicio.';
    if (d.limited && !(Number(d.maxUses) >= 1)) return 'Escribe cuántos pueden usarla.';
    if (d.perUser != null && !(Number(d.perUser) >= 1)) return 'Las veces por persona deben ser 1 o más.';
    if (this.needsUsers() && !d.users.length) return 'Elige al menos un usuario.';
    return null;
  }

  protected save(): void {
    if (this.saving() || this.formError()) return;
    const d = this.draft;
    const common = {
      title: d.title.trim(),
      discountType: d.discountType,
      discountValue: Number(d.discountValue),
      startsAt: new Date(d.startsAt).toISOString(),
      endsAt: new Date(d.endsAt).toISOString(),
      maxUses: d.limited ? Math.round(Number(d.maxUses)) : null,
      maxUsesPerUser: d.perUser == null ? null : Math.round(Number(d.perUser)),
      userIds: this.needsUsers() ? d.users.map((u) => u.id) : [],
    };
    this.saving.set(true);
    const done = finalize(() => this.saving.set(false));
    const onOk = (msg: string) => {
      this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      this.closeForm();
      this.tab() === 'subscription' ? this.loadSubscription() : this.loadBusiness();
    };
    const onErr = (err: Error) => this.snackBar.open(err?.message || 'No se pudo guardar', 'Cerrar', { duration: 5000 });

    if (this.tab() === 'subscription') {
      const body = { ...common, product: d.product, plans: d.plans, audience: d.subAudience };
      const req = d.id ? this.api.updateSubscription(d.id, body) : this.api.createSubscription(body);
      req.pipe(done, takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => onOk(d.id ? 'Promoción actualizada' : 'Promoción publicada'),
        error: onErr,
      });
    } else {
      const body = {
        ...common,
        scope: d.scope,
        serviceIds: d.scope === 'SERVICES' ? d.serviceIds : [],
        subcategoryIds: d.scope === 'CATEGORIES' ? d.subcategoryIds : [],
        audience: d.audience,
      };
      const pid = d.provider!.id;
      const req = d.id ? this.api.updateBusiness(pid, d.id, body) : this.api.createBusiness(pid, body);
      req.pipe(done, takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => onOk(d.id ? 'Promoción actualizada' : 'Promoción publicada en el negocio'),
        error: onErr,
      });
    }
  }

  // ─── Suscripción: lista y acciones ───

  private loadSubscription(): void {
    this.subLoading.set(true);
    this.api
      .listSubscription()
      .pipe(finalize(() => this.subLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.subscriptionList.set(list) });
  }

  protected editSubscription(p: SubscriptionPromotion): void {
    this.draft = {
      ...this.emptyDraft(),
      id: p.id,
      title: p.title,
      discountType: p.discountType,
      discountValue: p.discountValue,
      startsAt: toLocalInput(new Date(p.startsAt)),
      endsAt: toLocalInput(new Date(p.endsAt)),
      limited: p.maxUses != null,
      maxUses: p.maxUses,
      perUser: p.maxUsesPerUser === undefined ? 1 : p.maxUsesPerUser,
      product: p.product || 'SUBSCRIPTION',
      plans: [...(p.plans ?? [])],
      subAudience: p.audience,
      users: [...(p.users ?? [])],
    };
    this.formOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected toggleSubscription(p: SubscriptionPromotion): void {
    this.api.updateSubscription(p.id, { isActive: !p.isActive }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadSubscription(),
      error: (e: Error) => this.snackBar.open(e?.message || 'No se pudo cambiar', 'Cerrar', { duration: 4000 }),
    });
  }

  protected removeSubscription(p: SubscriptionPromotion): void {
    this.confirmRemove(p.title, () => this.api.removeSubscription(p.id), () => this.loadSubscription());
  }

  // ─── Citas: lista y acciones ───

  private loadBusiness(): void {
    this.bizLoading.set(true);
    this.api
      .listBusiness(this.bizPage() + 1, this.bizPageSize(), this.businessSearch.value.trim())
      .pipe(finalize(() => this.bizLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.businessList.set(res.items ?? []);
          this.bizTotal.set(res.total ?? 0);
        },
      });
  }

  protected onBizPage(e: PageEvent): void {
    this.bizPage.set(e.pageIndex);
    this.bizPageSize.set(e.pageSize);
    this.loadBusiness();
  }

  protected editBusiness(p: BusinessPromotion): void {
    this.draft = {
      ...this.emptyDraft(),
      id: p.id,
      title: p.title,
      discountType: p.discountType,
      discountValue: p.discountValue,
      startsAt: toLocalInput(new Date(p.startsAt)),
      endsAt: toLocalInput(new Date(p.endsAt)),
      limited: p.maxUses != null,
      maxUses: p.maxUses,
      perUser: p.maxUsesPerUser === undefined ? 1 : p.maxUsesPerUser,
      provider: { id: p.provider?.id, name: p.provider?.name, logoUrl: p.provider?.logoUrl } as unknown as Provider,
      scope: p.scope,
      serviceIds: [...(p.serviceIds ?? [])],
      subcategoryIds: [...(p.subcategoryIds ?? [])],
      audience: p.audience,
      users: [...(p.users ?? [])],
    };
    if (p.provider?.id) this.loadCatalog(p.provider.id);
    this.formOpen.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected toggleBusiness(p: BusinessPromotion): void {
    if (!p.provider?.id) return;
    this.api.updateBusiness(p.provider.id, p.id, { isActive: !p.isActive }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadBusiness(),
      error: (e: Error) => this.snackBar.open(e?.message || 'No se pudo cambiar', 'Cerrar', { duration: 4000 }),
    });
  }

  protected removeBusiness(p: BusinessPromotion): void {
    if (!p.provider?.id) return;
    const pid = p.provider.id;
    this.confirmRemove(p.title, () => this.api.removeBusiness(pid, p.id), () => this.loadBusiness());
  }

  private confirmRemove(title: string, request: () => ReturnType<PromotionService['removeSubscription']>, reload: () => void): void {
    this.confirmDialog
      .confirm({
        title: 'Eliminar promoción',
        message: `"${title}" dejará de aplicarse. Lo que ya se usó conserva su descuento.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        icon: 'delete',
        color: '#dc2626',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => request()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Promoción eliminada', 'Cerrar', { duration: 3000 });
          reload();
        },
        error: (e: Error) => this.snackBar.open(e?.message || 'No se pudo eliminar', 'Cerrar', { duration: 4000 }),
      });
  }

  // ─── Textos ───

  protected discountLabel(type: DiscountType, value: number | null): string {
    const v = Number(value) || 0;
    return type === 'PERCENT' ? `-${v}%` : `-${this.money(v)}`;
  }

  protected money(v: number): string {
    return '$' + (Number(v) || 0).toLocaleString('es-CO');
  }

  protected statusLabel(s: PromotionStatus): string {
    return STATUS_LABELS[s] ?? s;
  }

  protected audienceLabel(a: BusinessAudience): string {
    return BUSINESS_AUDIENCE_LABELS[a] ?? a;
  }

  protected planLabels(codes: string[], product: StoreProduct = 'SUBSCRIPTION'): string {
    const options = product === 'VERIFICATION' ? VERIFICATION_TARGETS : this.plans();
    if (!codes?.length) return product === 'VERIFICATION' ? 'Verificar usuario y negocio' : 'Todos los planes';
    return codes.map((c) => options.find((p) => p.code === c)?.label ?? c).join(', ');
  }

  protected previewScope(): string {
    if (this.tab() === 'subscription') return this.planLabels(this.draft.plans, this.draft.product);
    const d = this.draft;
    const biz = d.provider?.name ? `${d.provider.name} · ` : '';
    if (d.scope === 'SERVICES') return `${biz}${d.serviceIds.length} servicios`;
    if (d.scope === 'CATEGORIES') return `${biz}${d.subcategoryIds.length} categorías`;
    return `${biz}Todos los servicios`;
  }

  private emptyDraft(): Draft {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 0, 0);
    return {
      id: null,
      title: '',
      discountType: 'PERCENT',
      discountValue: null,
      startsAt: toLocalInput(now),
      endsAt: toLocalInput(end),
      limited: false,
      maxUses: null,
      perUser: 1,
      users: [],
      product: 'SUBSCRIPTION',
      plans: [],
      subAudience: 'EVERYONE',
      provider: null,
      scope: 'ALL',
      serviceIds: [],
      subcategoryIds: [],
      audience: 'EVERYONE',
    };
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Date → valor de <input type="datetime-local"> en hora local. */
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
