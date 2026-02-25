import { useSearchParams, useNavigate } from 'react-router-dom';
import { AsaasTransparentCheckout } from '@/components/AsaasTransparentCheckout';
import { PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import gravyxLogo from '@/assets/gravyx-logo.webp';
import { usePlanPricing, getPricing } from '@/hooks/usePlanPricing';

type BillingCycle = 'monthly' | 'annual';

const VALID_PLANS: TierKey[] = ['starter', 'premium', 'enterprise'];
const VALID_CYCLES: BillingCycle[] = ['monthly', 'annual'];

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: pricingRows, isLoading } = usePlanPricing();

  const plan = searchParams.get('plan') as TierKey | null;
  const cycle = searchParams.get('cycle') as BillingCycle | null;

  const isValid = plan && cycle && VALID_PLANS.includes(plan) && VALID_CYCLES.includes(cycle);

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
            <Button variant="outline" onClick={() => navigate('/projects')}>Ir para Projetos</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !pricingRows) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const row = getPricing(pricingRows, plan, cycle);
  if (!row) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-4">
        <img src={gravyxLogo} alt="GravyX" className="h-10" />
        <Card className="max-w-md w-full border-border/50 bg-card">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-foreground font-medium">Plano não encontrado</p>
            <Button variant="outline" onClick={() => navigate('/projects')}>Ir para Projetos</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priceReais = row.price / 100;
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
              {row.credits} créditos • R$ {priceReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              {cycle === 'annual' ? '/ano' : '/mês'}
            </p>
          </CardHeader>
          <CardContent>
            <AsaasTransparentCheckout
              tier={plan}
              cycle={cycle}
              price={priceReais}
              credits={row.credits}
              planLabel={config.label}
              onSuccess={() => navigate('/projects')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
