import { useState } from 'react';
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

type BillingCycle = 'monthly' | 'annual';

interface PlanInfo {
  tier: TierKey;
  icon: typeof Sparkles;
  monthly: { price: string; credits: number; checkout: string };
  annual: { price: string; installment: string; credits: number; checkout: string };
  highlight?: boolean;
  features: string[];
}

const plans: PlanInfo[] = [
  {
    tier: 'free',
    icon: Zap,
    monthly: { price: 'Grátis', credits: 5, checkout: '' },
    annual: { price: 'Grátis', installment: '', credits: 5, checkout: '' },
    features: ['5 créditos para testar', '1 projeto', 'Acesso à biblioteca'],
  },
  {
    tier: 'starter',
    icon: Sparkles,
    monthly: { price: 'R$ 79', credits: 80, checkout: 'https://checkout.ticto.app/O7A4C2615' },
    annual: { price: 'R$ 420/ano', installment: '12x de R$ 43,44', credits: 1000, checkout: 'https://checkout.ticto.app/OA871890B' },
    features: ['3 projetos', 'Suporte por email'],
  },
  {
    tier: 'premium',
    icon: Crown,
    highlight: true,
    monthly: { price: 'R$ 167', credits: 250, checkout: 'https://checkout.ticto.app/O465B8044' },
    annual: { price: 'R$ 1.097/ano', installment: '12x de R$ 113,46', credits: 3000, checkout: 'https://checkout.ticto.app/O06B270AF' },
    features: ['Projetos ilimitados', 'Suporte prioritário', 'Templates exclusivos'],
  },
  {
    tier: 'enterprise',
    icon: Rocket,
    monthly: { price: 'R$ 347', credits: 600, checkout: 'https://checkout.ticto.app/O8AA396EB' },
    annual: { price: 'R$ 2.597/ano', installment: '12x de R$ 268,59', credits: 7200, checkout: 'https://checkout.ticto.app/OA8BDDA9B' },
    features: ['Projetos ilimitados', 'Suporte dedicado', 'API access'],
  },
];

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const { profile } = useAuth();
  const currentTier = (profile?.tier as TierKey) || 'free';
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  const handleSelectPlan = (plan: PlanInfo) => {
    const url = cycle === 'monthly' ? plan.monthly.checkout : plan.annual.checkout;
    if (!url) return;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Escolha seu plano
            </DialogTitle>

            {/* Toggle mensal/anual */}
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              <button
                onClick={() => setCycle('monthly')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  cycle === 'monthly'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setCycle('annual')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  cycle === 'annual'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Anual
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  Economia
                </Badge>
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, i) => {
            const isCurrent = currentTier === plan.tier;
            const Icon = plan.icon;
            const config = PLAN_LIMITS[plan.tier];
            const data = cycle === 'monthly' ? plan.monthly : plan.annual;
            const credits = data.credits;

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

                <div className="mb-1">
                  <span className="text-2xl font-bold">{cycle === 'monthly' ? data.price : (plan.annual.installment || data.price)}</span>
                  {cycle === 'monthly' && plan.tier !== 'free' && (
                    <span className="text-sm text-muted-foreground">/mês</span>
                  )}
                </div>

                {cycle === 'annual' && plan.tier !== 'free' && (
                  <p className="text-xs text-muted-foreground mb-1">ou {plan.annual.price}</p>
                )}

                <p className="text-sm font-medium text-primary mb-3">
                  {credits} créditos{cycle === 'annual' && plan.tier !== 'free' ? '/ano' : plan.tier !== 'free' ? '/mês' : ''}
                </p>

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
                  onClick={() => handleSelectPlan(plan)}
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
