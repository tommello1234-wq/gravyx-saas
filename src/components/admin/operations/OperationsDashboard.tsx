import { Users, UserCheck, UserPlus, CreditCard, TrendingUp, UserMinus, ImageIcon, Coins, Wallet, BarChart3, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { DashboardData } from '../dashboard/useAdminDashboard';
import { AdminTopbar } from '../AdminTopbar';
import { useAdminContext } from '../AdminContext';
import { useAdminDashboard } from '../dashboard/useAdminDashboard';
import { ActivityChart } from '../dashboard/ActivityChart';
import { PlanDistribution } from '../dashboard/PlanDistribution';
import { TopUsersRanking } from '../dashboard/TopUsersRanking';
import { PlatformPerformance } from '../dashboard/PlatformPerformance';
import { AlertsBanner } from '../dashboard/AlertsBanner';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  growth?: number;
  sparkData?: number[];
  loading?: boolean;
  subtitle?: string;
}

function KpiCard({ title, value, icon, growth, sparkData = [], loading, subtitle }: KpiCardProps) {
  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  const hasGrowth = growth !== undefined && growth !== null;
  const isPositive = (growth || 0) >= 0;
  const chartData = sparkData.map((v) => ({ v }));

  return (
    <Card className="glass-card hover:border-primary/20 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {hasGrowth && (
                <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? '↑' : '↓'} {Math.abs(growth || 0).toFixed(1)}%
                </span>
              )}
              {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
            </div>
          </div>
          {sparkData.length > 1 && (
            <div className="w-20 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="opSparkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#opSparkGrad)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OperationsDashboard() {
  const { period, tierFilter, customRange } = useAdminContext();
  const data = useAdminDashboard(period, tierFilter, customRange);

  const sparkImages = data.activityByDay.map(d => d.images);
  const sparkUsers = data.activityByDay.map(d => d.users);

  const periodLabel = { today: 'hoje', '7d': '7d', '30d': '30d', '90d': '90d', custom: 'período' }[period];

  return (
    <>
      <AdminTopbar title="Dashboard — Operação" />
      <div className="p-6 space-y-6 animate-in fade-in duration-500">
        <AlertsBanner data={data} />

        {/* KPI Cards Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard title="Total Usuários" value={data.totalUsers} icon={<Users className="h-4 w-4 text-primary" />} growth={data.userGrowth} sparkData={sparkUsers} loading={data.isLoading} />
          <KpiCard title={`Ativos (${periodLabel})`} value={data.activeUsers} icon={<UserCheck className="h-4 w-4 text-primary" />} growth={data.activeUserGrowth} subtitle={`${data.totalUsers > 0 ? ((data.activeUsers / data.totalUsers) * 100).toFixed(0) : 0}% do total`} loading={data.isLoading} />
          <KpiCard title={`Novos (${periodLabel})`} value={data.newUsers} icon={<UserPlus className="h-4 w-4 text-primary" />} growth={data.newUserGrowth} loading={data.isLoading} />
          <KpiCard title="Assinaturas Ativas" value={data.paidSubscriptions} icon={<CreditCard className="h-4 w-4 text-primary" />} subtitle="tier ≠ free" loading={data.isLoading} />
          <KpiCard title={`Ativações (${periodLabel})`} value={data.newPaidSubscriptions} icon={<TrendingUp className="h-4 w-4 text-primary" />} loading={data.isLoading} />
          <KpiCard title="Churn Estimado" value={`${data.estimatedChurn}%`} icon={<UserMinus className="h-4 w-4 text-muted-foreground" />} subtitle="N/A (sem dados)" loading={data.isLoading} />
        </div>

        {/* Usage Cards Row 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard title={`Imagens (${periodLabel})`} value={data.periodImages.toLocaleString()} icon={<ImageIcon className="h-4 w-4 text-primary" />} growth={data.imageGrowth} sparkData={sparkImages} loading={data.isLoading} />
          <KpiCard title={`Créditos Consumidos`} value={data.creditsConsumed.toLocaleString()} icon={<Coins className="h-4 w-4 text-primary" />} loading={data.isLoading} />
          <KpiCard title="Créditos Restantes" value={data.creditsRemaining.toLocaleString()} icon={<Wallet className="h-4 w-4 text-primary" />} subtitle="soma saldos" loading={data.isLoading} />
          <KpiCard title="Média img/usuário" value={data.avgImagesPerActiveUser.toFixed(1)} icon={<BarChart3 className="h-4 w-4 text-primary" />} loading={data.isLoading} />
          <KpiCard title="Top Usuário" value={data.topUser?.count.toString() || '—'} icon={<Crown className="h-4 w-4 text-primary" />} subtitle={data.topUser?.name || ''} loading={data.isLoading} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityChart data={data} period={period === 'today' ? '7d' : period === 'custom' ? '30d' : period as any} onPeriodChange={() => {}} />
          </div>
          <PlanDistribution data={data} />
        </div>

        {/* Top Users */}
        <TopUsersRanking data={data} />

        {/* Platform Performance */}
        <PlatformPerformance data={data} />
      </div>
    </>
  );
}
