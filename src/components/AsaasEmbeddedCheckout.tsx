import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  checkoutId: string;
}

export function AsaasEmbeddedCheckout({ checkoutId }: Props) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="w-full min-h-[500px] relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <iframe
        src={`https://www.asaas.com/checkoutSession/show?id=${checkoutId}`}
        className="w-full min-h-[500px] border-0 rounded-lg"
        onLoad={() => setLoading(false)}
        allow="payment"
      />
    </div>
  );
}
