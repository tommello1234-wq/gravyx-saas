import { AlertTriangle, Info, XCircle } from 'lucide-react';
import type { DashboardData } from './useAdminDashboard';

interface AlertsBannerProps {
  data: DashboardData;
}

const iconMap = {
  error: <XCircle className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  info: <Info className="h-4 w-4 shrink-0" />,
};

const styleMap = {
  error: 'bg-destructive/10 border-destructive/30 text-destructive',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  info: 'bg-primary/10 border-primary/30 text-primary',
};

export function AlertsBanner({ data }: AlertsBannerProps) {
  if (data.isLoading || data.alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${styleMap[alert.type]}`}
        >
          {iconMap[alert.type]}
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}
