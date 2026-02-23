import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, CreditCard, Zap, BarChart3, UserX } from 'lucide-react';

interface MiniKpiProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

function MiniKpi({ label, value, icon }: MiniKpiProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

interface OperationalBlockProps {
  totalUsers: number;
  newUsers: number;
  paidActive: number;
  creditsConsumed: number;
  avgImagesPerActiveUser: number;
  zeroBalanceUsers: number;
  conversionRate: number;
  conversionsPeriod: number;
  periodLabel: string;
}

export function OperationalBlock({
  totalUsers, newUsers, paidActive, creditsConsumed,
  avgImagesPerActiveUser, zeroBalanceUsers, conversionRate, conversionsPeriod, periodLabel,
}: OperationalBlockProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Métricas Operacionais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MiniKpi label="Total Usuários" value={totalUsers} icon={<Users className="h-4 w-4 text-primary" />} />
          <MiniKpi label={`Novos (${periodLabel})`} value={newUsers} icon={<UserPlus className="h-4 w-4 text-emerald-400" />} />
          <MiniKpi label="Pagos Ativos" value={paidActive} icon={<CreditCard className="h-4 w-4 text-primary" />} />
          <MiniKpi label="Créditos Consumidos" value={creditsConsumed.toLocaleString('pt-BR')} icon={<Zap className="h-4 w-4 text-amber-400" />} />
          <MiniKpi label="Média/Usuário" value={avgImagesPerActiveUser.toFixed(1)} icon={<BarChart3 className="h-4 w-4 text-primary" />} />
          <MiniKpi label="Saldo Zero" value={zeroBalanceUsers} icon={<UserX className="h-4 w-4 text-red-400" />} />
          <MiniKpi label="Conv. Rate" value={`${conversionRate.toFixed(1)}%`} icon={<Users className="h-4 w-4 text-emerald-400" />} />
          <MiniKpi label={`Conversões (${periodLabel})`} value={conversionsPeriod} icon={<CreditCard className="h-4 w-4 text-emerald-400" />} />
        </div>
      </CardContent>
    </Card>
  );
}
