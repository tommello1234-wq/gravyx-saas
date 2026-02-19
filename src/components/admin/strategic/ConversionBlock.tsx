import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Percent, Play, UserCheck, UserX, TrendingDown } from 'lucide-react';
import type { DashboardData } from '../dashboard/useAdminDashboard';

interface Props { data: DashboardData }

export function ConversionBlock({ data }: Props) {
  const kpis = [
    { label: 'Conversão Trial→Pago', value: `${data.conversionRate.toFixed(1)}%`, icon: Percent },
    { label: 'Trials Iniciados', value: data.trialsStartedPeriod, icon: Play },
    { label: 'Conversões', value: data.conversionsPeriod, icon: UserCheck },
    { label: 'Cancelamentos', value: data.cancelledPeriod, icon: UserX },
    { label: 'Churn', value: `${data.churnRate.toFixed(1)}%`, icon: TrendingDown },
  ];

  // Funnel data
  const funnel = [
    { label: 'Usuários', value: data.totalUsers, color: 'hsl(220 15% 40%)' },
    { label: 'Trials', value: data.trialsStartedPeriod || data.trialsActive, color: 'hsl(197 100% 50%)' },
    { label: 'Pagos', value: data.conversionsPeriod || data.paidActive, color: 'hsl(225 100% 50%)' },
    { label: 'Ativos', value: data.paidActive, color: 'hsl(142 76% 36%)' },
  ];
  const maxFunnel = Math.max(1, ...funnel.map(f => f.value));

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-secondary" />
          Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <k.icon className="h-3.5 w-3.5" />
                {k.label}
              </div>
              <div className="text-xl font-bold">{typeof k.value === 'number' ? k.value.toLocaleString('pt-BR') : k.value}</div>
            </div>
          ))}
        </div>

        {/* Horizontal funnel */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Funil</p>
          <div className="flex items-center gap-2">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground mb-1">{f.label}</div>
                  <div className="h-8 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{ background: f.color, width: `${Math.max(30, (f.value / maxFunnel) * 100)}%`, minWidth: 40 }}>
                    {f.value}
                  </div>
                </div>
                {i < funnel.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
