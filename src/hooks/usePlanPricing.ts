import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlanPricingRow {
  id: string;
  tier: string;
  cycle: string;
  price: number; // centavos
  credits: number;
  max_projects: number;
  active: boolean;
}

export function usePlanPricing() {
  return useQuery({
    queryKey: ['plan-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_pricing')
        .select('*')
        .eq('active', true)
        .order('tier')
        .order('cycle');
      if (error) throw error;
      return data as PlanPricingRow[];
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

/** Helper: get price for a specific tier+cycle */
export function getPricing(rows: PlanPricingRow[], tier: string, cycle: string) {
  return rows.find(r => r.tier === tier && r.cycle === cycle);
}
