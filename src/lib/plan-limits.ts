export type TierKey = 'free' | 'starter' | 'premium' | 'enterprise';

export interface PlanConfig {
  label: string;
  creditsMonth: number;
  maxProjects: number; // -1 = unlimited
  libraryLimit: number; // -1 = unlimited, max visible images in library
}

export const PLAN_LIMITS: Record<TierKey, PlanConfig> = {
  free: { label: 'Free', creditsMonth: 5, maxProjects: 1, libraryLimit: 3 },
  starter: { label: 'Starter', creditsMonth: 80, maxProjects: 3, libraryLimit: -1 },
  premium: { label: 'Premium', creditsMonth: 250, maxProjects: -1, libraryLimit: -1 },
  enterprise: { label: 'Enterprise', creditsMonth: 600, maxProjects: -1, libraryLimit: -1 },
};

export const ALL_TIERS: TierKey[] = ['free', 'starter', 'premium', 'enterprise'];

/** Custo médio estimado por imagem gerada (Gemini 3 Pro via AI Gateway) */
export const ESTIMATED_COST_PER_IMAGE_USD = 0.06;

/** Taxa de conversão USD → BRL aproximada */
export const USD_TO_BRL_RATE = 5.80;

export function getTierConfig(tier: string): PlanConfig {
  return PLAN_LIMITS[tier as TierKey] ?? PLAN_LIMITS.free;
}
