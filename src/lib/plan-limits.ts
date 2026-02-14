export type TierKey = 'free' | 'starter' | 'premium' | 'enterprise';

export interface PlanConfig {
  label: string;
  creditsMonth: number;
  maxProjects: number; // -1 = unlimited
}

export const PLAN_LIMITS: Record<TierKey, PlanConfig> = {
  free: { label: 'Free', creditsMonth: 5, maxProjects: 1 },
  starter: { label: 'Starter', creditsMonth: 100, maxProjects: 3 },
  premium: { label: 'Premium', creditsMonth: 300, maxProjects: -1 },
  enterprise: { label: 'Enterprise', creditsMonth: 800, maxProjects: -1 },
};

export const ALL_TIERS: TierKey[] = ['free', 'starter', 'premium', 'enterprise'];

/** Custo médio estimado por imagem gerada (Gemini 3 Pro via AI Gateway) */
export const ESTIMATED_COST_PER_IMAGE_USD = 0.06;

/** Taxa de conversão USD → BRL aproximada */
export const USD_TO_BRL_RATE = 5.80;

export function getTierConfig(tier: string): PlanConfig {
  return PLAN_LIMITS[tier as TierKey] ?? PLAN_LIMITS.free;
}
