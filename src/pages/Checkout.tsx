import { useSearchParams, useNavigate } from 'react-router-dom';
import { AsaasTransparentCheckout } from '@/components/AsaasTransparentCheckout';
import { PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import gravyxLogo from '@/assets/gravyx-logo.webp';

type BillingCycle = 'monthly' | 'annual';

const VALID_PLANS: TierKey[] = ['starter', 'premium', 'enterprise'];
const VALID_CYCLES: BillingCycle[] = ['monthly', 'annual'];

interface PlanPricing {
  monthly: { price: number; credits: number };
  annual: { price: number; credits: number };
}

const PLAN_PRICING: Record<string, PlanPricing> = {
  starter: {
    monthly: { price: 79, credits: 80 },
    annual: { price: 420, credits: 1000 },
  },
  premium: {
    monthly: { price: 167, credits: 250 },
    annual: { price: 1097, credits: 3000 },
  },
  enterprise: {
    monthly: { price: 347, credits: 600 },
    annual: { price: 2597, credits: 7200 },
  },
};

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const plan = searchParams.get('plan') as TierKey | null;
  const cycle = searchParams.get('cycle') as BillingCycle | null;

  const isValid =
    plan && cycle &&
    VALID_PLANS.includes(plan) &&
    VALID_CYCLES.includes(cycle);

  if (!isValid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-4">
        <img src={gravyxLogo} alt="GravyX" className="h-10" />
        <Card className="max-w-md w-full border-border/50 bg-card">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-foreground font-medium">Link de checkout inválido</p>
            <p className="text-sm text-muted-foreground">
              Verifique se a URL contém os parâmetros <code className="text-primary">plan</code> e <code className="text-primary">cycle</code> corretos.
            </p>
            <Button variant="outline" onClick={() => navigate('/projects')}>
              Ir para Projetos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pricing = PLAN_PRICING[plan][cycle];
  const config = PLAN_LIMITS[plan];

  return (
    <div className="min-h-screen flex flex-col items-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center py-8">
          <img src={gravyxLogo} alt="GravyX" className="h-10" />
        </div>

        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-foreground">
              Assinar {config.label} — {cycle === 'monthly' ? 'Mensal' : 'Anual'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {pricing.credits} créditos • R$ {pricing.price.toLocaleString('pt-BR')}
              {cycle === 'annual' ? '/ano' : '/mês'}
            </p>
          </CardHeader>
          <CardContent>
            <AsaasTransparentCheckout
              tier={plan}
              cycle={cycle}
              price={pricing.price}
              credits={pricing.credits}
              planLabel={config.label}
              onSuccess={() => navigate('/projects')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
