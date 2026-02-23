import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';

interface Transaction {
  id: string;
  created_at: string | null;
  customer_email: string;
  product_id: string;
  amount_paid: number;
  transaction_id: string;
}

function detectGateway(transactionId: string): string {
  if (transactionId.startsWith('pay_')) return 'Asaas';
  return 'Ticto';
}

function detectPlan(productId: string): string {
  const lower = productId.toLowerCase();
  if (lower.includes('enterprise')) return 'Enterprise';
  if (lower.includes('premium') || lower.includes('creator')) return 'Premium';
  if (lower.includes('starter')) return 'Starter';
  return productId;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, 4);
  return `${visible}...@${domain}`;
}

function formatBRL(centavos: number) {
  return `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RecentTransactionsProps {
  purchases: Transaction[];
}

export function RecentTransactions({ purchases }: RecentTransactionsProps) {
  const recent = [...purchases]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 15);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg">Últimas Transações</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">{purchases.length} total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transação no período</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Usuário</TableHead>
                <TableHead className="text-xs">Plano</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Gateway</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((tx) => {
                const gateway = detectGateway(tx.transaction_id);
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {tx.created_at ? format(new Date(tx.created_at), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{maskEmail(tx.customer_email)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{detectPlan(tx.product_id)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{formatBRL(tx.amount_paid)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{gateway}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
