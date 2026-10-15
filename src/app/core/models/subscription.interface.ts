// Mismos valores que el backend (billing: UserSubscription / Transaction).
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED';
export type SubscriptionCycle = 'MONTHLY' | 'QUARTERLY' | 'SEMESTER' | 'YEARLY';
export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
export type PaymentStatus = 'PAID' | 'UNPAID' | 'NO_SUBSCRIPTION' | 'FREE_TRIAL';

/** Fila de GET /admin/subscriptions. */
export interface AdminSubscription {
  id: number;
  userId: string;
  userName: string;
  userEmail: string | null;
  status: SubscriptionStatus;
  plan: string;
  billingCycle: SubscriptionCycle;
  subscriptionTier: string | null;
  startAt: string;
  endAt: string;
  daysLeft: number;
  lastPaymentAt: string | null;
  amount: number;
  currency: string;
  autoRenew: boolean;
}

/** Fila de GET /admin/subscriptions/transactions. */
export interface AdminTransaction {
  id: number;
  reference: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  billingCycle: SubscriptionCycle;
  status: TransactionStatus;
  amount: number;
  currency: string;
  gateway: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** GET /admin/subscriptions/user/:userId */
export interface UserBilling {
  userId: string;
  paymentStatus: PaymentStatus;
  hasActiveSubscription: boolean;
  subscription: {
    id: number;
    status: SubscriptionStatus;
    plan: string;
    billingCycle: SubscriptionCycle;
    startAt: string;
    endAt: string;
    lastPaymentAt: string | null;
    amount: number;
    currency: string;
    autoRenew: boolean;
    subscriptionTier: string | null;
  } | null;
  transactions: {
    id: number;
    reference: string;
    billingCycle: SubscriptionCycle;
    status: TransactionStatus;
    amount: number;
    currency: string;
    gateway: string | null;
    paidAt: string | null;
    createdAt: string;
  }[];
}

/** AdminGrantSubscriptionDto */
export interface GrantSubscription {
  userId: string;
  billingCycle?: SubscriptionCycle;
  days?: number;
  amount?: number;
  note?: string;
}

export const SUBSCRIPTION_STATUS_MAP: Record<SubscriptionStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Activa', color: '#22c55e' },
  EXPIRED: { label: 'Vencida', color: '#f59e0b' },
  CANCELED: { label: 'Cancelada', color: '#ef4444' },
};

export const TRANSACTION_STATUS_MAP: Record<TransactionStatus, { label: string; color: string }> = {
  APPROVED: { label: 'Aprobada', color: '#22c55e' },
  PENDING: { label: 'Pendiente', color: '#f59e0b' },
  REJECTED: { label: 'Rechazada', color: '#ef4444' },
  CANCELED: { label: 'Cancelada', color: '#94a3b8' },
};

export const CYCLE_LABELS: Record<SubscriptionCycle, string> = {
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  SEMESTER: 'Semestral',
  YEARLY: 'Anual',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: 'Pagada',
  FREE_TRIAL: 'Prueba / cortesía',
  UNPAID: 'Sin pago (vencida)',
  NO_SUBSCRIPTION: 'Nunca ha tenido suscripción',
};
