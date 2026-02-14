import { useState } from 'react';
import { useAdminDashboard } from './useAdminDashboard';
import { KpiCards } from './KpiCards';
import { ActivityChart } from './ActivityChart';
import { PlanDistribution } from './PlanDistribution';
import { TopUsersRanking } from './TopUsersRanking';
import { PlatformPerformance } from './PlatformPerformance';
import { AlertsBanner } from './AlertsBanner';

type ChartPeriod = '7d' | '30d' | '90d' | '12m';

export function DashboardTab() {
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const data = useAdminDashboard(period === '12m' ? '90d' : period);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <AlertsBanner data={data} />
      <KpiCards data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityChart data={data} period={period} onPeriodChange={setPeriod} />
        </div>
        <PlanDistribution data={data} />
      </div>
      <TopUsersRanking data={data} />
      <PlatformPerformance data={data} />
    </div>
  );
}
