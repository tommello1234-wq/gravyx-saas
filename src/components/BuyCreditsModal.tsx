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
  description: string;
  monthly: { price: string; credits: number; checkout: string; installment?: string };
  annual: { price: string; installment: string; credits: number; checkout: string };
  highlight?: boolean;
  badge?: string;
  features: string[];
}

const plans: PlanInfo[] = [
  {
    tier: 'starter',
    icon: Zap,
    description: 'Para quem está começando a criar com IA',
    monthly: { price: 'R$ 79', credits: 80, checkout: 'https://checkout.ticto.app/O7A4C2615' },
    annual: { price: 'R$ 420/ano', installment: 'R$ 35', credits: 1000, checkout: 'https://checkout.ticto.app/OA871890B' },
    features: ['80 créditos/mês', '3 projetos', 'Acesso à biblioteca', 'Suporte por email'],
  },
  {
    tier: 'premium',
    icon: Crown,
    highlight: true,
    badge: 'MAIS POPULAR',
    description: 'Para criativos que buscam uso ilimitado e flexível',
    monthly: { price: 'R$ 167', credits: 250, checkout: 'https://checkout.ticto.app/O465B8044' },
    annual: { price: 'R$ 1.097/ano', installment: 'R$ 91,42', credits: 3000, checkout: 'https://checkout.ticto.app/O06B270AF' },
    features: ['250 créditos/mês', 'Projetos ilimitados', 'Templates exclusivos', 'Suporte prioritário'],
  },
  {
    tier: 'enterprise',
    icon: Rocket,
    badge: 'PROFISSIONAL',
    description: 'Para profissionais escalando sua produção de conteúdo',
    monthly: { price: 'R$ 347', credits: 600, checkout: 'https://checkout.ticto.app/O8AA396EB' },
    annual: { price: 'R$ 2.597/ano', installment: 'R$ 216,42', credits: 7200, checkout: 'https://checkout.ticto.app/OA8BDDA9B' },
    features: ['600 créditos/mês', 'Projetos ilimitados', 'API access', 'Suporte dedicado'],
  },
];

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const { profile } = useAuth();
  const currentTier = (profile?.tier as TierKey) || 'free';
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  const handleSelectPlan = (plan: PlanInfo) => {
    const url = cycle === 'monthly' ? plan.monthly.checkout : plan.annual.checkout;
    if (!url) return;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-[hsl(220,20%,8%)] border-border/50 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              Escolha seu plano
            </DialogTitle>

            {/* Toggle mensal/anual */}
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium transition-colors ${cycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Mensal
              </span>
              <button
                onClick={() => setCycle(c => c === 'monthly' ? 'annual' : 'monthly')}
                className="relative w-12 h-6 rounded-full bg-primary/30 transition-colors"
              >
                <motion.div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-primary shadow-md"
                  animate={{ left: cycle === 'annual' ? '26px' : '2px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${cycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Anual
              </span>
              {cycle === 'annual' && (
                <span className="text-xs font-semibold text-green-400">Economize até 55%</span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Plans grid */}
        <div className="px-6 pb-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const isCurrent = currentTier === plan.tier;
            const Icon = plan.icon;
            const config = PLAN_LIMITS[plan.tier];
            const data = cycle === 'monthly' ? plan.monthly : plan.annual;

            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                  plan.highlight
                    ? 'border-primary bg-primary/[0.06] shadow-[0_0_30px_-5px_hsl(var(--primary)/0.25)] scale-[1.02]'
                    : 'border-border/40 bg-[hsl(220,15%,11%)]'
                } ${isCurrent ? 'ring-2 ring-primary/60' : ''}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider ${
                    plan.highlight
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground border border-border/50'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                {/* Plan name & description */}
                <div className="flex items-center gap-2 mb-1 mt-1">
                  <Icon className={`h-5 w-5 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  <h3 className="text-lg font-bold text-foreground">{config.label}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>

                {/* Price */}
                <div className="mb-1">
                  {cycle === 'annual' ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-muted-foreground line-through">
                        {plan.monthly.price}
                      </span>
                      <span className="text-3xl font-bold text-foreground">{data.installment}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">{data.price}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                  )}
                </div>

                {cycle === 'annual' && (
                  <p className="text-xs text-muted-foreground mb-3">Cobrado anualmente {plan.annual.price}</p>
                )}
                {cycle === 'monthly' && <div className="mb-3" />}

                {/* CTA */}
                <Button
                  variant={isCurrent ? 'secondary' : plan.highlight ? 'default' : 'outline'}
                  className={`w-full rounded-xl h-11 font-semibold mb-5 ${
                    plan.highlight && !isCurrent
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20'
                      : ''
                  }`}
                  disabled={isCurrent}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {isCurrent ? 'Plano atual' : `Assinar ${config.label}`}
                </Button>

                {/* Credits highlight */}
                <div className={`rounded-xl p-3 mb-4 ${
                  plan.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 border border-border/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-4 w-4 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-semibold text-foreground">
                      {cycle === 'annual' ? data.credits.toLocaleString('pt-BR') + ' créditos/ano' : data.credits + ' créditos/mês'}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-primary' : 'text-green-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <div className="px-6 pb-5 pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            Pagamento seguro via Ticto · Cancele quando quiser · Sem taxa de cancelamento
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
