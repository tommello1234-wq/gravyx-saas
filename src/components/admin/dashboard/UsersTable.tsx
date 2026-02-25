import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Coins, MoreHorizontal, Send, Trash2, UserPlus, Search, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import type { DashboardData } from './useAdminDashboard';
import { format } from 'date-fns';

interface UsersTableProps {
  data: DashboardData;
  onUpdateCredits: (userId: string, credits: number) => void;
  onResendInvite: (userId: string, email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
  onCreateUser: () => void;
  isResending: boolean;
  costPerImage?: number;
}

type SortKey = 'email' | 'tier' | 'credits' | 'images' | 'created_at' | 'received' | 'cost';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

const formatBRL = (centavos: number) => {
  const value = centavos / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export function UsersTable({ data, onUpdateCredits, onResendInvite, onDeleteUser, onCreateUser, isResending, costPerImage = 0.30 }: UsersTableProps) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('email');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  // Build revenue map from purchases
  const revenueByUser = useMemo(() => {
    const map = new Map<string, number>();
    (data.purchases || []).forEach(p => {
      map.set(p.user_id, (map.get(p.user_id) || 0) + (p.amount_paid || 0));
    });
    return map;
  }, [data.purchases]);

  const filteredUsers = useMemo(() => {
    let users = data.profiles.map(p => ({
      ...p,
      images: p.total_generations || 0,
      received: revenueByUser.get(p.user_id) || 0,
      cost: Math.round((p.total_generations || 0) * costPerImage * 100),
    }));

    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u => u.email.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q));
    }

    if (tierFilter !== 'all') {
      users = users.filter(u => u.tier === tierFilter);
    }

    users.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'email': cmp = a.email.localeCompare(b.email); break;
        case 'tier': cmp = a.tier.localeCompare(b.tier); break;
        case 'credits': cmp = a.credits - b.credits; break;
        case 'images': cmp = a.images - b.images; break;
        case 'created_at': cmp = (a.created_at || '').localeCompare(b.created_at || ''); break;
        case 'received': cmp = a.received - b.received; break;
        case 'cost': cmp = a.cost - b.cost; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return users;
  }, [data.profiles, search, tierFilter, sortKey, sortDir, revenueByUser, costPerImage]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  const exportCSV = () => {
    const header = 'Email,Nome,Plano,Créditos,Imagens,Recebido,Custo,Data de Cadastro\n';
    const rows = filteredUsers.map(u =>
      `"${u.email}","${u.display_name || ''}","${u.tier}",${u.credits},${u.images},${(u.received / 100).toFixed(2)},${(u.cost / 100).toFixed(2)},"${u.created_at ? format(new Date(u.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tiers = useMemo(() => {
    const set = new Set(data.profiles.map(p => p.tier));
    return Array.from(set);
  }, [data.profiles]);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">Usuários ({filteredUsers.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button size="sm" className="rounded-full gap-1.5" onClick={onCreateUser}>
              <UserPlus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9"
            />
          </div>
          <Select value={tierFilter} onValueChange={v => { setTierFilter(v); setPage(0); }}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tiers.map(t => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>
                    Email <SortIcon col="email" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('tier')}>
                    Plano <SortIcon col="tier" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('credits')}>
                    Créditos <SortIcon col="credits" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('images')}>
                    Imagens <SortIcon col="images" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('received')}>
                    Recebido <SortIcon col="received" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('cost')}>
                    Custo <SortIcon col="cost" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                    Cadastro <SortIcon col="created_at" />
                  </TableHead>
                  <TableHead className="w-[130px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map(profile => {
                  const profit = profile.received - profile.cost;
                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{profile.display_name || profile.email}</p>
                          {profile.display_name && <p className="text-xs text-muted-foreground">{profile.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {profile.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Coins className="h-3 w-3 text-primary" />
                          {profile.credits}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{profile.images}</TableCell>
                      <TableCell className="text-right">
                        <span className={profile.received > 0 ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
                          {formatBRL(profile.received)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-muted-foreground">{formatBRL(profile.cost)}</span>
                          {profile.received > 0 && (
                            <span className={`text-xs flex items-center gap-0.5 ${profit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                              {profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatBRL(Math.abs(profit))}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {profile.created_at ? format(new Date(profile.created_at), 'dd/MM/yy') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="w-16 h-7 text-xs"
                            defaultValue={profile.credits}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (val !== profile.credits) onUpdateCredits(profile.user_id, val);
                            }}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => onResendInvite(profile.user_id, profile.email)}
                                disabled={isResending}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Reenviar acesso
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteUser(profile.user_id, profile.email)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover acesso
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
