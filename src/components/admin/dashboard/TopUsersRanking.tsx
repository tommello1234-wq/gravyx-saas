import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Coins, Trophy } from 'lucide-react';
import type { DashboardData } from './useAdminDashboard';

interface TopUsersRankingProps {
  data: DashboardData;
}

const medals = ['🥇', '🥈', '🥉'];

export function TopUsersRanking({ data }: TopUsersRankingProps) {
  if (data.isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (data.topUsers.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Top 10 Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma geração no período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Top 10 Usuários
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Imagens</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.topUsers.map((user, i) => (
              <TableRow key={user.user_id}>
                <TableCell className="text-lg">
                  {i < 3 ? medals[i] : <span className="text-sm text-muted-foreground">{i + 1}</span>}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{user.display_name || user.email}</p>
                    {user.display_name && (
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize text-xs">{user.tier}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{user.total_images}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Coins className="h-3 w-3 text-primary" />
                    {user.credits}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
