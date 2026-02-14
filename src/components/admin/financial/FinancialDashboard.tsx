import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Percent, BarChart3, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { AdminTopbar } from '../AdminTopbar';
import { useAdminContext } from '../AdminContext';
import { useAdminDashboard } from '../dashboard/useAdminDashboard';
import { PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';
import { ChevronDown, Settings, Download } from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['hsl(195, 100%, 50%)', 'hsl(210, 100%, 50%)', 'hsl(220, 90%, 56%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'];

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCentavos(val: number) {
  return formatBRL(val / 100);
}

export function FinancialDashboard() {
  const { period, tierFilter, customRange } = useAdminContext();

  const [costPerImage, setCostPerImage] = useState(() => {
    const saved = localStorage.getItem('admin_cost_per_image');
    return saved ? parseFloat(saved) : 0.30;
  });
  const [gatewayFee, setGatewayFee] = useState(() => {
    const saved = localStorage.getItem('admin_gateway_fee');
    return saved ? parseFloat(saved) : 0;
  });
  const [taxRate, setTaxRate] = useState(() => {
    const saved = localStorage.getItem('admin_tax_rate');
    return saved ? parseFloat(saved) : 0;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('admin_cost_per_image', costPerImage.toString());
    localStorage.setItem('admin_gateway_fee', gatewayFee.toString());
    localStorage.setItem('admin_tax_rate', taxRate.toString());
  }, [costPerImage, gatewayFee, taxRate]);

  const data = useAdminDashboard(period, tierFilter, customRange, costPerImage);

  const periodLabel = { today: 'hoje', '7d': '7d', '30d': '30d', '90d': '90d', custom: 'período' }[period];
  const netRevenue = data.periodRevenue * (1 - gatewayFee / 100) * (1 - taxRate / 100);

  const exportFinancialCSV = () => {
    const header = 'Plano,Assinaturas,Novas,Cancelamentos,Faturamento,Imagens,Custo,Lucro,Margem\n';
    const rows = data.financialByPlan.map(r =>
      `"${r.plan}",${r.activeSubscriptions},${r.newSubscriptions},${r.cancellations},"${formatCentavos(r.revenue)}",${r.images},"${formatCentavos(r.cost)}","${formatCentavos(r.profit)}","${r.margin.toFixed(1)}%"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatXAxis = (value: string) => {
    const d = new Date(value);
    return format(d, 'dd/MM');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-xl">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs">
            <span style={{ color: p.color }}>{p.name}</span>: {formatBRL(p.value)}
          </p>
        ))}
      </div>
    );
  };

  if (data.isLoading) {
    return (
      <>
        <AdminTopbar title="Dashboard — Financeiro" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glass-card"><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTopbar title="Dashboard — Financeiro" showExport onExportCSV={exportFinancialCSV} />
      <div className="p-6 space-y-6 animate-in fade-in duration-500">

        {/* Settings */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Card className="glass-card">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Configurações de Custo</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Custo por imagem (R$)</Label>
                    <Input type="number" step="0.01" value={costPerImage} onChange={e => setCostPerImage(parseFloat(e.target.value) || 0)} className="h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Taxa gateway (%)</Label>
                    <Input type="number" step="0.1" value={gatewayFee} onChange={e => setGatewayFee(parseFloat(e.target.value) || 0)} className="h-9 mt-1" />
                    <p className="text-[10px] text-muted-foreground mt-1">0 = desativado</p>
                  </div>
                  <div>
                    <Label className="text-xs">Imposto estimado (%)</Label>
                    <Input type="number" step="0.1" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="h-9 mt-1" />
                    <p className="text-[10px] text-muted-foreground mt-1">0 = desativado</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiFinCard title={`Faturamento (${periodLabel})`} value={formatCentavos(data.periodRevenue)} icon={<DollarSign className="h-4 w-4 text-primary" />} growth={data.revenueGrowth} />
          <KpiFinCard title="Receita Líquida" value={formatBRL(netRevenue / 100)} icon={<DollarSign className="h-4 w-4 text-primary" />} subtitle={gatewayFee > 0 || taxRate > 0 ? `- ${gatewayFee}% gw - ${taxRate}% imp` : 'sem taxas'} />
          <KpiFinCard title={`Custo (${periodLabel})`} value={formatCentavos(data.periodCost)} icon={<TrendingDown className="h-4 w-4 text-red-400" />} subtitle={`${data.periodImages} imgs × R$${costPerImage.toFixed(2)}`} />
          <KpiFinCard title={`Lucro (${periodLabel})`} value={formatCentavos(data.grossProfit)} icon={<TrendingUp className={`h-4 w-4 ${data.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />} />
          <KpiFinCard title="Margem" value={`${data.margin.toFixed(1)}%`} icon={<Percent className="h-4 w-4 text-primary" />} />
          <KpiFinCard title="MRR Estimado" value={formatCentavos(data.estimatedMRR)} icon={<Repeat className="h-4 w-4 text-primary" />} subtitle={`ARR: ${formatCentavos(data.estimatedARR)}`} />
        </div>

        {/* Charts Row 1: Revenue, Cost, Profit lines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Faturamento / dia</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Custo / dia</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="cost" name="Custo" stroke="hsl(0, 84%, 60%)" fill="hsl(0, 84%, 60%, 0.1)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Lucro / dia</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="date" tickFormatter={formatXAxis} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="profit" name="Lucro" stroke="hsl(142, 76%, 36%)" fill="hsl(142, 76%, 36%, 0.1)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2: Revenue by plan (bars), Cost by plan (bars), Revenue pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Receita por Plano</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.financialByPlan.filter(f => f.revenue > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="plan" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v / 100).toFixed(0)}`} />
                    <Tooltip formatter={(v: number) => formatCentavos(v)} />
                    <Bar dataKey="revenue" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Custo por Plano</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.financialByPlan.filter(f => f.cost > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="plan" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v / 100).toFixed(0)}`} />
                    <Tooltip formatter={(v: number) => formatCentavos(v)} />
                    <Bar dataKey="cost" name="Custo" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Participação de Receita</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px] flex items-center">
                {data.revenueByPlan.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.revenueByPlan} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={3} strokeWidth={0}>
                        {data.revenueByPlan.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center w-full">Sem dados de receita</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {data.revenueByPlan.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground capitalize">{item.name} ({formatBRL(item.value)})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Table */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Detalhamento por Plano</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportFinancialCSV}>
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Assinaturas</TableHead>
                  <TableHead className="text-right">Novas</TableHead>
                  <TableHead className="text-right">Cancelamentos</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Imagens</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.financialByPlan.map(row => (
                  <TableRow key={row.plan}>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{PLAN_LIMITS[row.plan as TierKey]?.label || row.plan}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.activeSubscriptions}</TableCell>
                    <TableCell className="text-right">{row.newSubscriptions}</TableCell>
                    <TableCell className="text-right text-muted-foreground">N/A</TableCell>
                    <TableCell className="text-right">{formatCentavos(row.revenue)}</TableCell>
                    <TableCell className="text-right">{row.images}</TableCell>
                    <TableCell className="text-right">{formatCentavos(row.cost)}</TableCell>
                    <TableCell className={`text-right font-medium ${row.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCentavos(row.profit)}
                    </TableCell>
                    <TableCell className="text-right">{row.margin.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function KpiFinCard({ title, value, icon, growth, subtitle }: { title: string; value: string; icon: React.ReactNode; growth?: number; subtitle?: string }) {
  const hasGrowth = growth !== undefined;
  const isPositive = (growth || 0) >= 0;
  return (
    <Card className="glass-card hover:border-primary/20 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">{icon}</div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {hasGrowth && (
            <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '↑' : '↓'} {Math.abs(growth || 0).toFixed(1)}%
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
