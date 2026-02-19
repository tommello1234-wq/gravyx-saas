import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, UserCheck, Play, Crown, AlertCircle } from 'lucide-react';
import type { DashboardData } from '../dashboard/useAdminDashboard';

interface Props { data: DashboardData }

export function UsageCostBlock({ data }: Props) {
  const kpis = [
    { label: 'Créditos Consumidos', value: data.creditsConsumed.toLocaleString('pt-BR'), icon: Zap },
    { label: 'Média/Pago', value: data.avgCreditsPerPaid.toFixed(1), icon: UserCheck },
    { label: 'Média/Trial', value: data.avgCreditsPerTrial.toFixed(1), icon: Play },
    { label: 'Top Consumidor', value: data.topUser?.name || '—', sub: data.topUser ? `${data.topUser.count} imgs` : '', icon: Crown },
    { label: 'Saldo Zero', value: data.zeroBalanceUsers.toLocaleString('pt-BR'), icon: AlertCircle },
  ];

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-yellow-400" />
          Uso & Custo Operacional
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
              <div className="text-lg font-bold truncate">{k.value}</div>
              {'sub' in k && k.sub && <div className="text-[10px] text-muted-foreground">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Top 5 consumers */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Top 5 Consumidores</p>
          <div className="space-y-1.5">
            {data.topUsers.slice(0, 5).map((u, i) => (
              <div key={u.user_id} className="flex items-center gap-3 text-xs rounded-md bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground w-4">{i + 1}.</span>
                <span className="flex-1 truncate">{u.display_name || u.email}</span>
                <span className="text-muted-foreground">{u.tier}</span>
                <span className="font-semibold">{u.total_images} imgs</span>
              </div>
            ))}
            {data.topUsers.length === 0 && <p className="text-xs text-muted-foreground">Sem dados no período</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
