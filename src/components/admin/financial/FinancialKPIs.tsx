import { DollarSign, TrendingUp, TrendingDown, Percent, Repeat, UserMinus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  growth?: number;
  subtitle?: string;
  variant?: 'default' | 'profit' | 'cost';
}

function KpiHeroCard({ title, value, icon, growth, subtitle, variant = 'default' }: KpiCardProps) {
  const hasGrowth = growth !== undefined;
  const isPositive = (growth || 0) >= 0;

  const borderClass = variant === 'profit'
    ? 'border-emerald-500/20 hover:border-emerald-500/40'
    : variant === 'cost'
    ? 'border-red-500/20 hover:border-red-500/40'
    : 'border-border/50 hover:border-primary/30';

  return (
    <Card className={`glass-card transition-all duration-300 ${borderClass}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</span>
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
        </div>
        <p className="text-2xl lg:text-3xl font-bold tracking-tight">{value}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {hasGrowth && (
            <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '↑' : '↓'} {Math.abs(growth || 0).toFixed(1)}%
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

interface FinancialKPIsProps {
  periodRevenue: number;
  revenueGrowth: number;
  mrr: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  churnRate: number;
  periodLabel: string;
}

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinancialKPIs({ periodRevenue, revenueGrowth, mrr, totalCosts, netProfit, profitMargin, churnRate, periodLabel }: FinancialKPIsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiHeroCard
        title={`Receita (${periodLabel})`}
        value={formatBRL(periodRevenue / 100)}
        icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
        growth={revenueGrowth}
      />
      <KpiHeroCard
        title="MRR Atual"
        value={formatBRL(mrr / 100)}
        icon={<Repeat className="h-4 w-4 text-primary" />}
        subtitle={`ARR: ${formatBRL((mrr * 12) / 100)}`}
      />
      <KpiHeroCard
        title={`Custos (${periodLabel})`}
        value={formatBRL(totalCosts / 100)}
        icon={<TrendingDown className="h-4 w-4 text-red-400" />}
        variant="cost"
      />
      <KpiHeroCard
        title={`Lucro Líquido`}
        value={formatBRL(netProfit / 100)}
        icon={<TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />}
        variant={netProfit >= 0 ? 'profit' : 'cost'}
      />
      <KpiHeroCard
        title="Margem"
        value={`${profitMargin.toFixed(1)}%`}
        icon={<Percent className={`h-4 w-4 ${profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />}
        variant={profitMargin >= 0 ? 'profit' : 'cost'}
      />
      <KpiHeroCard
        title="Churn Rate"
        value={`${churnRate.toFixed(1)}%`}
        icon={<UserMinus className={`h-4 w-4 ${churnRate > 5 ? 'text-red-400' : 'text-muted-foreground'}`} />}
        variant={churnRate > 5 ? 'cost' : 'default'}
      />
    </div>
  );
}
