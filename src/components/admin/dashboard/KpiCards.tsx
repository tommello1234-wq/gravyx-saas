import { Users, UserCheck, ImageIcon, Coins, DollarSign, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { DashboardData } from './useAdminDashboard';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  growth: number;
  sparkData: number[];
  loading?: boolean;
  subtitle?: string;
}

function KpiCard({ title, value, icon, growth, sparkData, loading, subtitle }: KpiCardProps) {
  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-5">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = growth >= 0;
  const chartData = sparkData.map((v, i) => ({ v }));

  return (
    <Card className="glass-card hover:border-primary/20 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '↑' : '↓'} {Math.abs(growth).toFixed(1)}%
              </span>
              {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
            </div>
          </div>
          {sparkData.length > 1 && (
            <div className="w-20 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    fill="url(#sparkGradient)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface KpiCardsProps {
  data: DashboardData;
}

export function KpiCards({ data }: KpiCardsProps) {
  const sparkImages = data.activityByDay.map(d => d.images);
  const sparkUsers = data.activityByDay.map(d => d.users);

  const formatCurrency = (val: number) => {
    return `R$ ${(val / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const cards = [
    {
      title: 'Total Usuários',
      value: data.totalUsers,
      icon: <Users className="h-4 w-4 text-primary" />,
      growth: data.userGrowth,
      sparkData: sparkUsers,
    },
    {
      title: 'Ativos (30d)',
      value: data.activeUsers,
      icon: <UserCheck className="h-4 w-4 text-primary" />,
      growth: data.activeUserGrowth,
      subtitle: `${data.totalUsers > 0 ? ((data.activeUsers / data.totalUsers) * 100).toFixed(0) : 0}% do total`,
    },
    {
      title: 'Imagens Geradas',
      value: data.totalImages.toLocaleString(),
      icon: <ImageIcon className="h-4 w-4 text-primary" />,
      growth: data.imageGrowth,
      sparkData: sparkImages,
    },
    {
      title: 'Créditos Consumidos',
      value: data.estimatedCreditsConsumed.toLocaleString(),
      icon: <Coins className="h-4 w-4 text-primary" />,
      growth: 0,
      sparkData: [],
      subtitle: 'estimativa',
    },
    {
      title: 'Receita Total',
      value: formatCurrency(data.totalRevenue),
      icon: <DollarSign className="h-4 w-4 text-primary" />,
      growth: data.revenueGrowth,
      sparkData: [],
    },
    {
      title: 'Taxa de Atividade',
      value: `${data.activityRate.toFixed(1)}%`,
      icon: <Activity className="h-4 w-4 text-primary" />,
      growth: 0,
      sparkData: [],
      subtitle: 'com ≥1 imagem',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <KpiCard
          key={card.title}
          {...card}
          sparkData={card.sparkData || []}
          loading={data.isLoading}
        />
      ))}
    </div>
  );
}
