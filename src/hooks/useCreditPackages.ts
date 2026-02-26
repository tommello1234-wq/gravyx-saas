import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  product_id: string | null;
}

export function useCreditPackages() {
  return useQuery({
    queryKey: ['credit-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_packages')
        .select('*')
        .order('credits', { ascending: true });
      if (error) throw error;
      return data as CreditPackage[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
