// Mismos valores que el backend (/api/admin/promotions).

export type DiscountType = 'PERCENT' | 'AMOUNT';
export type PromotionStatus = 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'SOLD_OUT' | 'PAUSED';

export const STATUS_LABELS: Record<PromotionStatus, string> = {
  ACTIVE: 'Activa',
  SCHEDULED: 'Programada',
  ENDED: 'Terminada',
  SOLD_OUT: 'Agotada',
  PAUSED: 'Pausada',
};

/** Usuario elegido (resumen). */
export interface PromotionUser {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  img?: string | null;
}

// ─── Tienda: suscripción o verificación ───
export type SubscriptionAudience = 'EVERYONE' | 'SELECTED';
export type StoreProduct = 'SUBSCRIPTION' | 'VERIFICATION';

/** Qué se verifica (va en "plans" cuando el producto es VERIFICATION). */
export const VERIFICATION_TARGETS: SubscriptionPlanOption[] = [
  { code: 'ACCOUNT', label: 'Verificar usuario' },
  { code: 'PROVIDER', label: 'Verificar negocio' },
];

export interface SubscriptionPlanOption {
  code: string;
  label: string;
}

export interface SubscriptionPromotion {
  id: number;
  title: string;
  product: StoreProduct;
  discountType: DiscountType;
  discountValue: number;
  label: string;
  /** Planes (suscripción) o ACCOUNT/PROVIDER (verificación); vacío = todos. */
  plans: string[];
  startsAt: string;
  endsAt: string;
  maxUses: number | null;
  /** Veces que cada usuario la puede usar (1 por defecto); null = sin límite. */
  maxUsesPerUser: number | null;
  usedCount: number;
  audience: SubscriptionAudience;
  userIds: string[];
  users?: PromotionUser[];
  isActive: boolean;
  status: PromotionStatus;
}

export type SubscriptionPromotionInput = Pick<
  SubscriptionPromotion,
  'title' | 'product' | 'discountType' | 'discountValue' | 'plans' | 'startsAt' | 'endsAt' | 'maxUses' | 'maxUsesPerUser' | 'audience' | 'userIds'
>;

// ─── Citas de los negocios ───
export type BusinessScope = 'ALL' | 'SERVICES' | 'CATEGORIES';
export type BusinessAudience = 'EVERYONE' | 'CLIENTS' | 'FOLLOWERS' | 'EMPLOYEES' | 'SELECTED';

export const BUSINESS_AUDIENCE_LABELS: Record<BusinessAudience, string> = {
  EVERYONE: 'Todos',
  CLIENTS: 'Clientes del negocio',
  FOLLOWERS: 'Seguidores del negocio',
  EMPLOYEES: 'Empleados del negocio',
  SELECTED: 'Usuarios específicos',
};

export interface BusinessPromotion {
  id: number;
  title: string;
  discountType: DiscountType;
  discountValue: number;
  scope: BusinessScope;
  serviceIds: number[];
  subcategoryIds: number[];
  startsAt: string;
  endsAt: string;
  maxUses: number | null;
  /** Veces que cada persona la puede usar (1 por defecto); null = sin límite. */
  maxUsesPerUser: number | null;
  usedCount: number;
  audience: BusinessAudience;
  userIds: string[];
  users?: PromotionUser[];
  isActive: boolean;
  status: PromotionStatus;
  createdByAdmin: boolean;
  provider?: { id: number; name: string | null; logoUrl: string | null };
}

export type BusinessPromotionInput = Pick<
  BusinessPromotion,
  'title' | 'discountType' | 'discountValue' | 'scope' | 'serviceIds' | 'subcategoryIds' | 'startsAt' | 'endsAt' | 'maxUses' | 'maxUsesPerUser' | 'audience' | 'userIds'
>;

export interface PromotionCatalogItem {
  id: number;
  name: string;
  price: number;
  subcategoryId: number | null;
  subcategoryName: string | null;
}
