import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';

type ChartView = 'financial' | 'operational' | 'users';

interface RevenueChartProps {
  revenueByDay: { date: string; revenue: number; cost: number; profit: number }[];
  planDistribution?: { name: string; value: number }[];
  imagesByResolutionByDay?: { date: string; '1K': number; '2K': number; '4K': number }[];
  usersByDay?: { date: string; newUsers: number; activeUsers: number }[];
  imagesByResolution?: { '1K': number; '2K': number; '4K': number };
}

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'hsl(142, 76%, 36%)',
  premium: 'hsl(250, 76%, 60%)',
  enterprise: 'hsl(30, 90%, 55%)',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

const RES_COLORS = {
  '1K': 'hsl(210, 76%, 55%)',
  '2K': 'hsl(142, 76%, 36%)',
  '4K': 'hsl(30, 90%, 55%)',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-4 py-3 shadow-xl">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>{' '}
          <span className="font-semibold">{typeof p.value === 'number' && p.name !== 'Novos' && p.name !== 'Ativos' && !['1K', '2K', '4K'].includes(p.name) ? formatBRL(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <p className="text-sm font-medium">{d.name}: {d.value}</p>
    </div>
  );
};

export function RevenueChart({ revenueByDay, planDistribution = [], imagesByResolutionByDay = [], usersByDay = [], imagesByResolution }: RevenueChartProps) {
  const [view, setView] = useState<ChartView>('financial');

  const formatXAxis = (value: string) => {
    const d = new Date(value);
    return format(d, 'dd/MM');
  };

  const paidPlans = planDistribution
    .filter(p => p.name !== 'free' && p.value > 0)
    .map(p => ({ ...p, name: PLAN_LABELS[p.name] || p.name }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      {/* Main Chart */}
      <Card className="glass-card lg:col-span-7">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">Visão do Dashboard</CardTitle>
            <Tabs value={view} onValueChange={(v) => setView(v as ChartView)}>
              <TabsList className="h-8">
                <TabsTrigger value="financial" className="text-xs px-3 h-7">Financeiro</TabsTrigger>
                <TabsTrigger value="operational" className="text-xs px-3 h-7">Operacional</TabsTrigger>
                <TabsTrigger value="users" className="text-xs px-3 h-7">Usuários</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              {view === 'financial' ? (
                <AreaChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${v.toFixed(0)}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%, 0.08)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="cost" name="Custos" stroke="hsl(0, 84%, 60%)" fill="hsl(0, 84%, 60%, 0.08)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="profit" name="Lucro" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.08)" strokeWidth={2} dot={false} />
                </AreaChart>
              ) : view === 'operational' ? (
                <AreaChart data={imagesByResolutionByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="1K" name="1K" stackId="1" stroke={RES_COLORS['1K']} fill={RES_COLORS['1K']} fillOpacity={0.3} strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="2K" name="2K" stackId="1" stroke={RES_COLORS['2K']} fill={RES_COLORS['2K']} fillOpacity={0.3} strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="4K" name="4K" stackId="1" stroke={RES_COLORS['4K']} fill={RES_COLORS['4K']} fillOpacity={0.3} strokeWidth={2} dot={false} />
                </AreaChart>
              ) : (
                <BarChart data={usersByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="newUsers" name="Novos" fill="hsl(250, 76%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="activeUsers" name="Ativos" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {/* Resolution summary for operational view */}
          {view === 'operational' && imagesByResolution && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <span className="text-xs text-muted-foreground">Total no período:</span>
              <span className="text-xs font-semibold" style={{ color: RES_COLORS['1K'] }}>1K: {imagesByResolution['1K']}</span>
              <span className="text-xs font-semibold" style={{ color: RES_COLORS['2K'] }}>2K: {imagesByResolution['2K']}</span>
              <span className="text-xs font-semibold" style={{ color: RES_COLORS['4K'] }}>4K: {imagesByResolution['4K']}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pie Chart */}
      <Card className="glass-card lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Distribuição por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center">
            {paidPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem assinantes pagos</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paidPlans}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {paidPlans.map((entry, idx) => (
                      <Cell key={idx} fill={Object.values(PLAN_COLORS)[idx % Object.values(PLAN_COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
