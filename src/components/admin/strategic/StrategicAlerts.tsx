import { AlertTriangle, TrendingDown, XCircle, Zap } from 'lucide-react';
import type { DashboardData } from '../dashboard/useAdminDashboard';

interface Props { data: DashboardData }

export function StrategicAlerts({ data }: Props) {
  if (data.isLoading) return null;

  const alerts: { type: 'error' | 'warning' | 'info'; icon: React.ReactNode; message: string }[] = [];

  // Conversion < 5%
  if (data.conversionRate < 5 && data.trialsStartedPeriod > 0) {
    alerts.push({ type: 'error', icon: <XCircle className="h-4 w-4 shrink-0" />, message: `Conversão Trial→Pago em ${data.conversionRate.toFixed(1)}% — abaixo de 5%` });
  }

  // >40% trials sem créditos
  if (data.trialsWithNoCreditsUsed > 40 && data.trialsActive > 0) {
    alerts.push({ type: 'warning', icon: <AlertTriangle className="h-4 w-4 shrink-0" />, message: `${data.trialsWithNoCreditsUsed.toFixed(0)}% dos trials não consumiram nenhum crédito` });
  }

  // Margem < 30%
  if (data.periodRevenue > 0 && data.margin < 30) {
    alerts.push({ type: 'error', icon: <TrendingDown className="h-4 w-4 shrink-0" />, message: `Margem em ${data.margin.toFixed(1)}% — abaixo de 30%` });
  }

  // Custo crescendo mais que receita
  if (data.costGrowthVsRevenue > 0) {
    alerts.push({ type: 'warning', icon: <Zap className="h-4 w-4 shrink-0" />, message: `Custo crescendo mais rápido que receita` });
  }

  if (alerts.length === 0) return null;

  const styles = {
    error: 'bg-destructive/10 border-destructive/30 text-destructive',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    info: 'bg-primary/10 border-primary/30 text-primary',
  };

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${styles[a.type]}`}>
          {a.icon}
          <span>{a.message}</span>
        </div>
      ))}
    </div>
  );
}
