import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, Crown, Zap, Rocket, ArrowLeft, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';
import { AsaasTransparentCheckout } from '@/components/AsaasTransparentCheckout';
import { usePlanPricing, type PlanPricingRow } from '@/hooks/usePlanPricing';
import { useCreditPackages, type CreditPackage } from '@/hooks/useCreditPackages';

interface BuyCreditsModalProps { open: boolean; onOpenChange: (open: boolean) => void; }
type BillingCycle = 'monthly' | 'annual';

const TIER_ICONS: Record<string, typeof Sparkles> = { starter: Zap, premium: Crown, enterprise: Rocket };
const TIER_ORDER: TierKey[] = ['starter', 'premium', 'enterprise'];
const TIER_DESCRIPTIONS: Record<string, string> = {
  starter: 'Para quem está começando a criar com IA',
  premium: 'Para criativos que buscam uso ilimitado e flexível',
  enterprise: 'Para profissionais escalando sua produção de conteúdo',
};

function buildPlanData(rows: PlanPricingRow[]) {
  return TIER_ORDER.map(tier => {
    const m = rows.find(r => r.tier === tier && r.cycle === 'monthly');
    const a = rows.find(r => r.tier === tier && r.cycle === 'annual');
    if (!m || !a) return null;
    const mPrice = m.price / 100;
    const aPrice = a.price / 100;
    const highlight = tier === 'premium';
    const badge = tier === 'premium' ? 'MAIS POPULAR' : tier === 'enterprise' ? 'PROFISSIONAL' : undefined;
    const costMonthly = `R$${(mPrice / m.credits).toFixed(2).replace('.', ',')}`;
    const costAnnual = `R$${(aPrice / a.credits).toFixed(2).replace('.', ',')}`;
    const features = [
      `${m.credits} créditos/mês`,
      m.max_projects === -1 ? 'Projetos ilimitados' : `Até ${m.max_projects} projetos ativos`,
      tier === 'starter' ? 'Templates essenciais' : 'Acesso a todos os Templates de Fluxos',
      'Acesso completo à biblioteca de referências',
      ...(tier === 'enterprise' ? ['Acesso antecipado a novas ferramentas'] : []),
    ];
    return {
      tier, icon: TIER_ICONS[tier] || Zap, description: TIER_DESCRIPTIONS[tier] || '',
      monthly: { price: `R$ ${mPrice.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, priceNum: mPrice, credits: m.credits },
      annual: {
        price: `R$ ${aPrice.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/ano`,
        installment: `R$ ${(aPrice / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        priceNum: aPrice, credits: a.credits,
      },
      highlight, badge, features,
      costPerImageMonthly: costMonthly, costPerImageAnnual: costAnnual,
    };
  }).filter(Boolean) as NonNullable<ReturnType<typeof buildPlanData>[number]>[];
}

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const currentTier = (profile?.tier as TierKey) || 'free';
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const [selectedPlan, setSelectedPlan] = useState<{ tier: TierKey; cycle: BillingCycle } | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const { data: pricingRows, isLoading } = usePlanPricing();
  const { data: creditPackages } = useCreditPackages();
  const showCreditPackages = !!profile;

  const plans = pricingRows ? buildPlanData(pricingRows) : [];

  const handleSelectPlan = (plan: typeof plans[number]) => {
    setSelectedPlan({ tier: plan.tier as TierKey, cycle });
  };

  const handleClose = (value: boolean) => {
    if (!value) { setSelectedPlan(null); setSelectedPackage(null); }
    onOpenChange(value);
  };

  // Transparent checkout view — one-off package
  if (selectedPackage) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg bg-[hsl(220,20%,8%)] border-border/50 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedPackage(null)} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-lg text-foreground">Comprar {selectedPackage.name}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 pb-6">
            <AsaasTransparentCheckout
              tier={currentTier as TierKey}
              cycle="monthly"
              price={Number(selectedPackage.price_brl)}
              credits={selectedPackage.credits}
              planLabel={selectedPackage.name}
              onSuccess={() => handleClose(false)}
              isOneOff
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Transparent checkout view — plan subscription
  if (selectedPlan) {
    const plan = plans.find(p => p.tier === selectedPlan.tier);
    if (!plan) return null;
    const data = selectedPlan.cycle === 'monthly' ? plan.monthly : plan.annual;
    const config = PLAN_LIMITS[selectedPlan.tier];

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg bg-[hsl(220,20%,8%)] border-border/50 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedPlan(null)} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-lg text-foreground">Assinar {config.label}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 pb-6">
            <AsaasTransparentCheckout
              tier={selectedPlan.tier}
              cycle={selectedPlan.cycle}
              price={data.priceNum}
              credits={data.credits}
              planLabel={config.label}
              onSuccess={() => handleClose(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl bg-[hsl(220,20%,8%)] border-border/50 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('modal.choose_plan')}
            </DialogTitle>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium transition-colors ${cycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('modal.monthly')}</span>
              <button onClick={() => setCycle(c => c === 'monthly' ? 'annual' : 'monthly')} className="relative w-12 h-6 rounded-full bg-primary/30 transition-colors">
                <motion.div className="absolute top-0.5 w-5 h-5 rounded-full bg-primary shadow-md" animate={{ left: cycle === 'annual' ? '26px' : '2px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              </button>
              <span className={`text-sm font-medium transition-colors ${cycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>{t('modal.annual')}</span>
              {cycle === 'annual' && <span className="text-xs font-semibold text-green-400">{t('modal.save_up_to')}</span>}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="px-6 pb-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan, i) => {
              const isCurrent = currentTier === plan.tier;
              const Icon = plan.icon;
              const config = PLAN_LIMITS[plan.tier as TierKey];
              const data = cycle === 'monthly' ? plan.monthly : plan.annual;
              return (
                <motion.div key={plan.tier} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-all ${plan.highlight ? 'border-primary bg-primary/[0.06] shadow-[0_0_30px_-5px_hsl(var(--primary)/0.25)] scale-[1.02]' : 'border-border/40 bg-[hsl(220,15%,11%)]'} ${isCurrent ? 'ring-2 ring-primary/60' : ''}`}>
                  {plan.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider ${plan.highlight ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border/50'}`}>{plan.badge}</div>
                  )}
                  <div className="flex items-center gap-2 mb-1 mt-1">
                    <Icon className={`h-5 w-5 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                    <h3 className="text-lg font-bold text-foreground">{config.label}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>
                  <div className="mb-1">
                    {cycle === 'annual' ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-muted-foreground line-through">{plan.monthly.price}</span>
                        <span className="text-3xl font-bold text-foreground">{plan.annual.installment}</span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">{data.price}</span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                    )}
                  </div>
                  {cycle === 'annual' && <p className="text-xs text-muted-foreground mb-3">{t('modal.billed_annually')} {plan.annual.price}</p>}
                  {cycle === 'monthly' && <div className="mb-3" />}
                  <Button variant={isCurrent ? 'secondary' : plan.highlight ? 'default' : 'outline'} className={`w-full rounded-xl h-11 font-semibold mb-5 ${plan.highlight && !isCurrent ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20' : ''}`} disabled={isCurrent} onClick={() => handleSelectPlan(plan)}>
                    {isCurrent ? t('modal.current_plan') : `${t('modal.subscribe')} ${config.label}`}
                  </Button>
                  <div className={`rounded-xl p-3 mb-4 ${plan.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 border border-border/30'}`}>
                    <div className="flex items-center gap-2">
                      <Sparkles className={`h-4 w-4 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-semibold text-foreground">
                        {cycle === 'annual' ? data.credits.toLocaleString('pt-BR') + ' ' + t('modal.credits_per_year') : data.credits + ' ' + t('modal.credits_per_month')}
                      </span>
                    </div>
                  </div>
                  <ul className="flex-1 space-y-2.5">
                    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-primary' : 'text-green-500'}`} />
                      Apenas {cycle === 'monthly' ? plan.costPerImageMonthly : plan.costPerImageAnnual} por imagem
                    </li>
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
        )}

        {/* One-off credit packages for active subscribers */}
        {showCreditPackages && creditPackages && creditPackages.length > 0 && (
          <div className="px-6 pb-2">
            <div className="border-t border-border/30 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Precisa de mais créditos?</h3>
                <span className="text-xs text-muted-foreground ml-1">Compra avulsa</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {creditPackages.map((pkg) => (
                  <motion.div key={pkg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border/40 bg-[hsl(220,15%,11%)] p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors">
                    <span className="text-2xl font-bold text-foreground">{pkg.credits}</span>
                    <span className="text-xs text-muted-foreground">créditos</span>
                    <span className="text-lg font-semibold text-primary">R$ {Number(pkg.price_brl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <Button variant="outline" size="sm" className="w-full rounded-lg mt-1" onClick={() => setSelectedPackage(pkg)}>
                      Comprar
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-5 pt-2 text-center space-y-1">
          <p className="text-xs text-muted-foreground">{t('modal.secure_payment')}</p>
          <p className="text-xs text-muted-foreground">{t('modal.card_required')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
