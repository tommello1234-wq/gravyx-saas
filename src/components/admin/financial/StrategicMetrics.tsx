import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Target, Scale, BarChart3 } from 'lucide-react';

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface StrategicMetricsProps {
  arpu: number; // centavos
  churnRate: number; // %
  mrr: number; // centavos
  mrrGrowth: number; // %
  totalFixedCosts: number; // centavos
}

export function StrategicMetrics({ arpu, churnRate, mrr, mrrGrowth, totalFixedCosts }: StrategicMetricsProps) {
  const monthlyChurn = churnRate / 100;
  const ltv = monthlyChurn > 0 && arpu > 0 ? arpu / monthlyChurn : 0;
  const projectedRevenue = mrr * (1 + (mrrGrowth / 100));
  const breakEvenSubs = arpu > 0 ? Math.ceil(totalFixedCosts / arpu) : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Métricas Estratégicas</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="LTV Estimado"
          value={ltv > 0 ? formatBRL(ltv / 100) : 'N/A'}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          subtitle={ltv > 0 ? `ARPU / Churn mensal` : 'Sem dados de churn'}
        />
        <MetricCard
          title="Receita Projetada"
          value={formatBRL(projectedRevenue / 100)}
          icon={<Target className="h-4 w-4 text-primary" />}
          subtitle="Próximo mês (MRR + tendência)"
        />
        <MetricCard
          title="Break-even"
          value={breakEvenSubs > 0 ? `${breakEvenSubs} assinantes` : 'N/A'}
          icon={<Scale className="h-4 w-4 text-primary" />}
          subtitle={totalFixedCosts > 0 ? `Custos fixos / ARPU` : 'Adicione custos fixos'}
        />
        <MetricCard
          title="Crescimento MRR"
          value={`${mrrGrowth.toFixed(1)}%`}
          icon={<BarChart3 className={`h-4 w-4 ${mrrGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />}
          subtitle="vs período anterior"
          positive={mrrGrowth >= 0}
        />
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, subtitle, positive }: { title: string; value: string; icon: React.ReactNode; subtitle: string; positive?: boolean }) {
  return (
    <Card className="glass-card hover:border-primary/20 transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>
        </div>
        <p className={`text-xl font-bold ${positive === false ? 'text-red-400' : positive === true ? 'text-emerald-400' : ''}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
