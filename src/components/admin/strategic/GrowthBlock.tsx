import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Users, UserPlus, Play, CreditCard, PieChart } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell } from 'recharts';
import type { DashboardData } from '../dashboard/useAdminDashboard';

interface Props { data: DashboardData }

const PLAN_COLORS = ['hsl(220 15% 40%)', 'hsl(197 100% 50%)', 'hsl(225 100% 50%)', 'hsl(142 76% 36%)'];

type ChartMode = 'total' | 'trials' | 'paid';

export function GrowthBlock({ data }: Props) {
  const [mode, setMode] = useState<ChartMode>('total');

  const kpis = [
    { label: 'Total Usuários', value: data.totalUsers, icon: Users },
    { label: 'Novos (período)', value: data.newUsers, icon: UserPlus, growth: data.newUserGrowth },
    { label: 'Trials Ativos', value: data.trialsActive, icon: Play },
    { label: 'Pagos Ativos', value: data.paidActive, icon: CreditCard },
  ];

  const dataKey = mode === 'total' ? 'users' : mode === 'trials' ? 'trials' : 'paid';
  const chartConfig = { [dataKey]: { label: mode === 'total' ? 'Usuários' : mode === 'trials' ? 'Trials' : 'Pagos', color: 'hsl(var(--primary))' } };

  // Build chart data with trial/paid counts per day from activityByDay
  const chartData = data.activityByDay.map(d => ({
    date: d.date.slice(5), // MM-DD
    users: d.users,
    trials: 0, // simplified - we don't have daily trial/paid breakdown
    paid: 0,
  }));

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          Crescimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <k.icon className="h-3.5 w-3.5" />
                {k.label}
              </div>
              <div className="text-xl font-bold">{k.value.toLocaleString('pt-BR')}</div>
              {k.growth !== undefined && (
                <span className={`text-xs ${k.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {k.growth >= 0 ? '+' : ''}{k.growth.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
          {/* Mini donut */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 flex items-center gap-2">
            <div className="w-10 h-10">
              <RechartsPie width={40} height={40}>
                <Pie data={data.planDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={10} outerRadius={18} strokeWidth={0}>
                  {data.planDistribution.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />)}
                </Pie>
              </RechartsPie>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Planos</div>
              {data.planDistribution.map((p, i) => (
                <div key={p.name} className="text-[10px] flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                  {p.name}: {p.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart toggle + chart */}
        <div className="flex gap-1 text-xs">
          {(['total', 'trials', 'paid'] as ChartMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md transition-colors ${mode === m ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'total' ? 'Usuários' : m === 'trials' ? 'Trials' : 'Pagos'}
            </button>
          ))}
        </div>
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(220 10% 40%)" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(220 10% 40%)" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey={dataKey} stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
