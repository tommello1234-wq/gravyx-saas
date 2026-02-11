import { useState } from 'react';
import { useAdminDashboard, type Period } from './useAdminDashboard';
import { KpiCards } from './KpiCards';
import { ActivityChart } from './ActivityChart';
import { PlanDistribution } from './PlanDistribution';
import { TopUsersRanking } from './TopUsersRanking';
import { PlatformPerformance } from './PlatformPerformance';
import { AlertsBanner } from './AlertsBanner';

export function DashboardTab() {
  const [period, setPeriod] = useState<Period>('30d');
  const data = useAdminDashboard(period);

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
