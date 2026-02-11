import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Server, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import type { DashboardData } from './useAdminDashboard';

interface PlatformPerformanceProps {
  data: DashboardData;
}

export function PlatformPerformance({ data }: PlatformPerformanceProps) {
  const [open, setOpen] = useState(false);

  if (data.isLoading) {
    return <Skeleton className="h-14 w-full rounded-xl" />;
  }

  const metrics = [
    {
      title: 'Jobs Processados',
      value: data.totalJobs.toLocaleString(),
      icon: <Server className="h-4 w-4 text-primary" />,
    },
    {
      title: 'Erros (24h)',
      value: data.jobErrors24h,
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
    },
    {
      title: 'Taxa de Sucesso',
      value: `${data.jobSuccessRate.toFixed(1)}%`,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="glass-card">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <span className="font-medium">Performance da Plataforma</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {metrics.map(m => (
                <div key={m.title} className="rounded-lg bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {m.icon}
                    <span className="text-xs text-muted-foreground">{m.title}</span>
                  </div>
                  <p className="text-xl font-bold">{m.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
