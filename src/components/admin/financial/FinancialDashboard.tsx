import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AdminTopbar } from '../AdminTopbar';
import { useAdminContext } from '../AdminContext';
import { useAdminDashboard } from '../dashboard/useAdminDashboard';
import { FinancialKPIs } from './FinancialKPIs';
import { RevenueChart } from './RevenueChart';
import { CostsManager, useCostConfig, calculateTotalCosts } from './CostsManager';
import { SubscriptionsBlock } from './SubscriptionsBlock';
import { StrategicMetrics } from './StrategicMetrics';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinancialDashboard() {
  const { period, tierFilter, customRange } = useAdminContext();
  const { costs, updateCosts } = useCostConfig();

  const data = useAdminDashboard(period, tierFilter, customRange, costs.costPerImage);

  const periodLabel = { today: 'hoje', '7d': '7d', '30d': '30d', '90d': '90d', custom: 'período' }[period];

  const costBreakdown = calculateTotalCosts(costs, data.periodImages, data.periodRevenue);
  const netProfit = data.periodRevenue - costBreakdown.total;
  const profitMargin = data.periodRevenue > 0 ? (netProfit / data.periodRevenue) * 100 : 0;

  // Recalculate revenueByDay with full costs
  const revenueByDayWithCosts = data.revenueByDay.map(d => {
    const dayCostBreakdown = calculateTotalCosts(costs, 0, d.revenue * 100);
    // Image cost is already in d.cost, add platform fees and taxes proportionally
    const extraCosts = (dayCostBreakdown.paymentFee + dayCostBreakdown.tax) / 100;
    const totalDayCost = d.cost + extraCosts;
    return { ...d, cost: totalDayCost, profit: d.revenue - totalDayCost };
  });

  // Churn revenue estimate
  const planPrices: Record<string, number> = { starter: 7900, premium: 16700, enterprise: 34700 };
  const churnRevenue = data.cancelledPeriod * (data.arpu || 0);

  const exportCSV = () => {
    const rows = [
      `Período,${periodLabel}`,
      `Receita Total,${formatBRL(data.periodRevenue / 100)}`,
      `MRR,${formatBRL(data.estimatedMRR / 100)}`,
      `Custos Totais,${formatBRL(costBreakdown.total / 100)}`,
      `Lucro Líquido,${formatBRL(netProfit / 100)}`,
      `Margem,${profitMargin.toFixed(1)}%`,
      `Churn Rate,${data.churnRate.toFixed(1)}%`,
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (data.isLoading) {
    return (
      <>
        <AdminTopbar title="Financeiro" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glass-card"><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card className="glass-card"><CardContent className="p-5"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTopbar title="Financeiro" showExport onExportCSV={exportCSV} />
      <div className="p-6 space-y-8 animate-in fade-in duration-500">
        {/* 1. KPIs Hero */}
        <FinancialKPIs
          periodRevenue={data.periodRevenue}
          revenueGrowth={data.revenueGrowth}
          mrr={data.estimatedMRR}
          totalCosts={costBreakdown.total}
          netProfit={netProfit}
          profitMargin={profitMargin}
          churnRate={data.churnRate}
          periodLabel={periodLabel}
        />

        {/* 2. Main Chart */}
        <RevenueChart revenueByDay={revenueByDayWithCosts} />

        {/* 3. Costs Manager */}
        <CostsManager
          costs={costs}
          onCostsChange={updateCosts}
          periodImages={data.periodImages}
          periodRevenue={data.periodRevenue}
        />

        {/* 4. Subscriptions */}
        <SubscriptionsBlock
          paidActive={data.paidActive}
          newPaidSubscriptions={data.newPaidSubscriptions}
          cancelledPeriod={data.cancelledPeriod}
          churnRevenue={churnRevenue}
          arpu={data.arpu}
          financialByPlan={data.financialByPlan}
        />

        {/* 5. Strategic Metrics */}
        <StrategicMetrics
          arpu={data.arpu}
          churnRate={data.churnRate}
          mrr={data.estimatedMRR}
          mrrGrowth={data.revenueGrowth}
          totalFixedCosts={costs.fixedCosts.reduce((s, f) => s + f.value * 100, 0)}
        />
      </div>
    </>
  );
}
