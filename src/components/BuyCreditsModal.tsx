import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, Crown, Zap, Rocket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans: {
  tier: TierKey;
  icon: typeof Sparkles;
  price: string;
  priceNote: string;
  highlight?: boolean;
  features: string[];
}[] = [
  {
    tier: 'free',
    icon: Zap,
    price: 'Grátis',
    priceNote: 'para sempre',
    features: ['5 créditos para testar', '1 projeto', 'Acesso à biblioteca'],
  },
  {
    tier: 'starter',
    icon: Sparkles,
    price: 'R$ 49',
    priceNote: '/mês',
    features: ['100 créditos/mês', '3 projetos', 'Suporte por email'],
  },
  {
    tier: 'premium',
    icon: Crown,
    price: 'R$ 99',
    priceNote: '/mês',
    highlight: true,
    features: ['300 créditos/mês', 'Projetos ilimitados', 'Suporte prioritário', 'Templates exclusivos'],
  },
  {
    tier: 'enterprise',
    icon: Rocket,
    price: 'R$ 199',
    priceNote: '/mês',
    features: ['800 créditos/mês', 'Projetos ilimitados', 'Suporte dedicado', 'API access'],
  },
];

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const { profile } = useAuth();
  const currentTier = (profile?.tier as TierKey) || 'free';

  // TODO: replace with real checkout URLs from Ticto
  const handleSelectPlan = (tier: TierKey) => {
    if (tier === 'free' || tier === currentTier) return;
    // Placeholder – will open Ticto checkout link when available
    window.open('https://chat.whatsapp.com/HlrgOxOWRPlLjr0wFXCoff', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Escolha seu plano
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, i) => {
            const isCurrent = currentTier === plan.tier;
            const Icon = plan.icon;
            const config = PLAN_LIMITS[plan.tier];

            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative flex flex-col rounded-xl border p-4 transition-all ${
                  plan.highlight
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border bg-background/50'
                } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs">
                    Popular
                  </Badge>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{config.label}</span>
                </div>

                <div className="mb-4">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
                </div>

                <ul className="flex-1 space-y-2 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? 'secondary' : plan.highlight ? 'default' : 'outline'}
                  className="w-full rounded-lg"
                  disabled={isCurrent || plan.tier === 'free'}
                  onClick={() => handleSelectPlan(plan.tier)}
                >
                  {isCurrent ? 'Plano atual' : plan.tier === 'free' ? 'Grátis' : 'Assinar'}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-muted-foreground">
            Pagamento seguro via Ticto. Cancele quando quiser.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
