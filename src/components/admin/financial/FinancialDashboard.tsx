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
import { RecentTransactions } from './RecentTransactions';
import { OperationalBlock } from './OperationalBlock';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinancialDashboard() {
  const { period, tierFilter, customRange, resolutionFilter } = useAdminContext();
  const { costs, updateCosts } = useCostConfig();

  const data = useAdminDashboard(period, tierFilter, customRange, costs.costPerImage, resolutionFilter);

  const periodLabel = { today: 'hoje', '7d': '7d', '30d': '30d', '90d': '90d', custom: 'período' }[period];

  const costBreakdown = calculateTotalCosts(costs, data.periodImages, data.periodRevenue);
  const netProfit = data.periodRevenue - costBreakdown.total;
  const profitMargin = data.periodRevenue > 0 ? (netProfit / data.periodRevenue) * 100 : 0;

  // Recalculate revenueByDay with full costs
  const revenueByDayWithCosts = data.revenueByDay.map(d => {
    const dayCostBreakdown = calculateTotalCosts(costs, 0, d.revenue * 100);
    const extraCosts = (dayCostBreakdown.paymentFee + dayCostBreakdown.tax) / 100;
    const totalDayCost = d.cost + extraCosts;
    return { ...d, cost: totalDayCost, profit: d.revenue - totalDayCost };
  });

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
    a.download = `dashboard-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (data.isLoading) {
    return (
      <>
        <AdminTopbar title="Dashboard" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glass-card"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
          <Card className="glass-card"><CardContent className="p-4"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTopbar title="Dashboard" showExport onExportCSV={exportCSV} />
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
          imagesByResolution={data.imagesByResolution}
        />

        {/* 2. Costs Manager (above chart) */}
        <CostsManager
          costs={costs}
          onCostsChange={updateCosts}
          periodImages={data.periodImages}
          periodRevenue={data.periodRevenue}
        />

        {/* 3. Chart + Pie side by side */}
        <RevenueChart
          revenueByDay={revenueByDayWithCosts}
          planDistribution={data.planDistribution}
          imagesByResolutionByDay={data.imagesByResolutionByDay}
          usersByDay={data.usersByDay}
          imagesByResolution={data.imagesByResolution}
        />

        {/* 4. Recent Transactions */}
        <RecentTransactions purchases={data.purchases} />

        {/* 5. Subscriptions */}
        <SubscriptionsBlock
          paidActive={data.paidActive}
          newPaidSubscriptions={data.newPaidSubscriptions}
          cancelledPeriod={data.cancelledPeriod}
          churnRevenue={churnRevenue}
          arpu={data.arpu}
          financialByPlan={data.financialByPlan}
        />

        {/* 6. Strategic Metrics */}
        <StrategicMetrics
          arpu={data.arpu}
          churnRate={data.churnRate}
          mrr={data.estimatedMRR}
          mrrGrowth={data.revenueGrowth}
          totalFixedCosts={costs.fixedCosts.reduce((s, f) => s + f.value * 100, 0)}
        />

        {/* 7. Operational Block */}
        <OperationalBlock
          totalUsers={data.totalUsers}
          newUsers={data.newUsers}
          paidActive={data.paidActive}
          creditsConsumed={data.estimatedCreditsConsumed}
          avgImagesPerActiveUser={data.avgImagesPerActiveUser}
          zeroBalanceUsers={data.zeroBalanceUsers}
          conversionRate={data.conversionRate}
          conversionsPeriod={data.conversionsPeriod}
          periodLabel={periodLabel}
        />
      </div>
    </>
  );
}
