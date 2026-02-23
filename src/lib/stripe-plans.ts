import type { TierKey } from './plan-limits';

export interface StripePlan {
  price_id: string;
  product_id: string;
}

export const STRIPE_PLANS: Record<Exclude<TierKey, 'free'>, StripePlan> = {
  starter: {
    price_id: 'price_1T2dH9QaS2QCKPVAO3z0v3as',
    product_id: 'prod_U0eazTPI46cBd4',
  },
  premium: {
    price_id: 'price_1T2dNOQaS2QCKPVAPcfLgTg6',
    product_id: 'prod_U0eg3wu7ck4oGW',
  },
  enterprise: {
    price_id: 'price_1T2dSeQaS2QCKPVAboY5jaQF',
    product_id: 'prod_U0emfKast87JEJ',
  },
};

/** Reverse lookup: price_id → tier */
export const PRICE_TO_TIER: Record<string, Exclude<TierKey, 'free'>> = Object.fromEntries(
  Object.entries(STRIPE_PLANS).map(([tier, plan]) => [plan.price_id, tier as Exclude<TierKey, 'free'>])
) as Record<string, Exclude<TierKey, 'free'>>;
