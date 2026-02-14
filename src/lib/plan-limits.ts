export type TierKey = 'free' | 'starter' | 'creator' | 'enterprise';

export interface PlanConfig {
  label: string;
  creditsMonth: number;
  maxProjects: number; // -1 = unlimited
}

export const PLAN_LIMITS: Record<TierKey, PlanConfig> = {
  free: { label: 'Free', creditsMonth: 5, maxProjects: 1 },
  starter: { label: 'Starter', creditsMonth: 100, maxProjects: 3 },
  creator: { label: 'Creator', creditsMonth: 300, maxProjects: -1 },
  enterprise: { label: 'Enterprise', creditsMonth: 800, maxProjects: -1 },
};

export const ALL_TIERS: TierKey[] = ['free', 'starter', 'creator', 'enterprise'];

export function getTierConfig(tier: string): PlanConfig {
  return PLAN_LIMITS[tier as TierKey] ?? PLAN_LIMITS.free;
}
