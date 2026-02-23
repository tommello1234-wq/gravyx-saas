import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

type ChartView = 'overview' | 'mrr' | 'profit';

interface RevenueChartProps {
  revenueByDay: { date: string; revenue: number; cost: number; profit: number }[];
  mrrByDay?: { date: string; mrr: number }[];
}

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-4 py-3 shadow-xl">
      <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm">
          <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>{' '}
          <span className="font-semibold">{formatBRL(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export function RevenueChart({ revenueByDay }: RevenueChartProps) {
  const [view, setView] = useState<ChartView>('overview');

  const formatXAxis = (value: string) => {
    const d = new Date(value);
    return format(d, 'dd/MM');
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Visão Financeira</CardTitle>
          <Tabs value={view} onValueChange={(v) => setView(v as ChartView)}>
            <TabsList className="h-8">
              <TabsTrigger value="overview" className="text-xs px-3 h-7">Receita × Custos × Lucro</TabsTrigger>
              <TabsTrigger value="profit" className="text-xs px-3 h-7">Lucro</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'overview' ? (
              <AreaChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${v.toFixed(0)}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%, 0.08)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="cost" name="Custos" stroke="hsl(0, 84%, 60%)" fill="hsl(0, 84%, 60%, 0.08)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="profit" name="Lucro" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.08)" strokeWidth={2} dot={false} />
              </AreaChart>
            ) : (
              <AreaChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${v.toFixed(0)}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="profit" name="Lucro" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%, 0.15)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
