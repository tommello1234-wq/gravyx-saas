import { useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';

const stripePromise = loadStripe('pk_live_51KJQPNQaS2QCKPVAb4flOc3i4JkLrNsacKv5MpOoGI0hitjmbJYJsgFmAvp2FhcJtY2Sw9Tscwl59orvaenvJoC60069snD03j');

interface Props {
  priceId: string;
  tier: string;
}

export function StripeEmbeddedCheckout({ priceId, tier }: Props) {
  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { price_id: priceId, tier },
    });
    if (error) throw error;
    return data.client_secret as string;
  }, [priceId, tier]);

  return (
    <div className="w-full min-h-[400px]">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout className="w-full" />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
