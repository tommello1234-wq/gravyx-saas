import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { DashboardData, Period } from './useAdminDashboard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Metric = 'images' | 'users' | 'credits';

interface ActivityChartProps {
  data: DashboardData;
  period: Period;
  onPeriodChange: (p: Period) => void;
}

const metricLabels: Record<Metric, string> = {
  images: 'Imagens Geradas',
  users: 'Novos Usuários',
  credits: 'Créditos Consumidos',
};

const periods: { value: Period; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '12m', label: '12m' },
];

export function ActivityChart({ data, period, onPeriodChange }: ActivityChartProps) {
  const [metric, setMetric] = useState<Metric>('images');

  if (data.isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  const formatXAxis = (value: string) => {
    if (period === '12m') {
      const [y, m] = value.split('-');
      return format(new Date(parseInt(y), parseInt(m) - 1), 'MMM', { locale: ptBR });
    }
    const d = new Date(value);
    return format(d, 'dd/MM');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.[0]) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-semibold">{metricLabels[metric]}: {payload[0].value}</p>
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">Atividade</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-lg bg-muted/50 p-0.5">
              {(Object.keys(metricLabels) as Metric[]).map(m => (
                <Button
                  key={m}
                  variant={metric === m ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setMetric(m)}
                >
                  {metricLabels[m]}
                </Button>
              ))}
            </div>
            <div className="flex items-center rounded-lg bg-muted/50 p-0.5">
              {periods.map(p => (
                <Button
                  key={p.value}
                  variant={period === p.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => onPeriodChange(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.activityByDay}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#activityGradient)"
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
