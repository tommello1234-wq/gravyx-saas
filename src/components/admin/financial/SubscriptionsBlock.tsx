import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, UserMinus, DollarSign, BarChart3 } from 'lucide-react';
import { PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface MiniKpiProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

function MiniKpi({ title, value, icon }: MiniKpiProps) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface SubscriptionsBlockProps {
  paidActive: number;
  newPaidSubscriptions: number;
  cancelledPeriod: number;
  churnRevenue: number; // centavos
  arpu: number; // centavos
  financialByPlan: { plan: string; activeSubscriptions: number; newSubscriptions: number; revenue: number; images: number }[];
}

export function SubscriptionsBlock({ paidActive, newPaidSubscriptions, cancelledPeriod, churnRevenue, arpu, financialByPlan }: SubscriptionsBlockProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assinaturas</h3>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniKpi title="Ativos" value={paidActive.toString()} icon={<Users className="h-4 w-4 text-primary" />} />
        <MiniKpi title="Novas" value={newPaidSubscriptions.toString()} icon={<UserPlus className="h-4 w-4 text-emerald-400" />} />
        <MiniKpi title="Cancelamentos" value={cancelledPeriod.toString()} icon={<UserMinus className="h-4 w-4 text-red-400" />} />
        <MiniKpi title="Receita perdida" value={formatBRL(churnRevenue / 100)} icon={<DollarSign className="h-4 w-4 text-red-400" />} />
        <MiniKpi title="ARPU" value={formatBRL(arpu / 100)} icon={<BarChart3 className="h-4 w-4 text-primary" />} />
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Assinantes</TableHead>
                <TableHead className="text-right">Novas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Imagens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialByPlan.filter(r => r.plan !== 'free').map(row => (
                <TableRow key={row.plan}>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{PLAN_LIMITS[row.plan as TierKey]?.label || row.plan}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.activeSubscriptions}</TableCell>
                  <TableCell className="text-right">{row.newSubscriptions}</TableCell>
                  <TableCell className="text-right">{formatBRL(row.revenue / 100)}</TableCell>
                  <TableCell className="text-right">{row.images}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
