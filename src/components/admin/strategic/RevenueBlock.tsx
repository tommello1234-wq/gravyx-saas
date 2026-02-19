import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Percent, UserCheck } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings2 } from 'lucide-react';
import type { DashboardData } from '../dashboard/useAdminDashboard';

interface Props {
  data: DashboardData;
  costPerImage: number;
  onCostChange: (v: number) => void;
}

type ChartMode = 'revenue' | 'cost' | 'profit' | 'mrr';

const modeColors: Record<ChartMode, string> = {
  revenue: 'hsl(142 76% 36%)',
  cost: 'hsl(0 84% 60%)',
  profit: 'hsl(225 100% 50%)',
  mrr: 'hsl(197 100% 50%)',
};

export function RevenueBlock({ data, costPerImage, onCostChange }: Props) {
  const [mode, setMode] = useState<ChartMode>('revenue');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fmt = (v: number) => `R$ ${(v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const kpis = [
    { label: 'MRR Atual', value: fmt(data.estimatedMRR), icon: TrendingUp },
    { label: 'Receita (período)', value: fmt(data.periodRevenue), icon: DollarSign },
    { label: 'Custo (período)', value: fmt(data.periodCost), icon: TrendingDown },
    { label: 'Lucro Líquido', value: fmt(data.grossProfit), icon: DollarSign },
    { label: 'Margem', value: `${data.margin.toFixed(1)}%`, icon: Percent },
    { label: 'ARPU', value: fmt(data.arpu), icon: UserCheck },
  ];

  const chartData = data.revenueByDay.map(d => ({
    date: d.date.slice(5),
    revenue: d.revenue,
    cost: d.cost,
    profit: d.profit,
    mrr: data.estimatedMRR / 100, // flat line for MRR
  }));

  const chartConfig = { [mode]: { label: mode === 'revenue' ? 'Receita' : mode === 'cost' ? 'Custo' : mode === 'profit' ? 'Lucro' : 'MRR', color: modeColors[mode] } };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          Receita & Lucro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost settings */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="h-3.5 w-3.5" />
            Configurações de custo
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex items-center gap-3 text-xs">
              <label className="text-muted-foreground">Custo/imagem (R$):</label>
              <input type="number" step="0.01" min="0" value={costPerImage}
                onChange={e => onCostChange(parseFloat(e.target.value) || 0)}
                className="w-20 bg-muted/50 border border-border/50 rounded px-2 py-1 text-xs" />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <k.icon className="h-3.5 w-3.5" />
                {k.label}
              </div>
              <div className="text-lg font-bold">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Chart toggle */}
        <div className="flex gap-1 text-xs">
          {(['revenue', 'cost', 'profit', 'mrr'] as ChartMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md transition-colors ${mode === m ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'revenue' ? 'Receita' : m === 'cost' ? 'Custo' : m === 'profit' ? 'Lucro' : 'MRR'}
            </button>
          ))}
        </div>
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(220 10% 40%)" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(220 10% 40%)" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey={mode} stroke={modeColors[mode]} fill={`${modeColors[mode].replace(')', ' / 0.15)')}`} strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
