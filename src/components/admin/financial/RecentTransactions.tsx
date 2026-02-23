import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { Receipt, MoreHorizontal, RotateCcw, Copy, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  created_at: string | null;
  customer_email: string;
  product_id: string;
  amount_paid: number;
  transaction_id: string;
  user_id: string;
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
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const recent = [...purchases]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 15);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const handleRefund = async () => {
    if (!refundTx) return;
    setIsRefunding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('admin-refund', {
        body: { transactionId: refundTx.transaction_id, targetUserId: refundTx.user_id },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });

      if (error) {
        const errorBody = error instanceof Object && 'context' in error ? await (error as any).context?.json?.() : null;
        throw new Error(errorBody?.error || error.message || 'Erro ao processar reembolso');
      }

      toast({
        title: 'Reembolso processado',
        description: data?.message || 'Usuário rebaixado para Free.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro no reembolso',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsRefunding(false);
      setRefundTx(null);
    }
  };

  return (
    <>
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
                  <TableHead className="text-xs w-10"></TableHead>
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
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCopy(tx.customer_email, 'E-mail')}>
                              <Copy className="h-3.5 w-3.5 mr-2" />
                              Copiar e-mail
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopy(tx.transaction_id, 'ID da transação')}>
                              <Hash className="h-3.5 w-3.5 mr-2" />
                              Copiar ID transação
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setRefundTx(tx)}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-2" />
                              Reembolsar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!refundTx} onOpenChange={(open) => !open && setRefundTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reembolso</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Tem certeza que deseja reembolsar esta transação?</p>
                {refundTx && (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <p><strong>Usuário:</strong> {refundTx.customer_email}</p>
                    <p><strong>Valor:</strong> {formatBRL(refundTx.amount_paid)}</p>
                    <p><strong>Gateway:</strong> {detectGateway(refundTx.transaction_id)}</p>
                    {!refundTx.transaction_id.startsWith('pay_') && (
                      <p className="text-amber-500 font-medium mt-2">
                        ⚠️ Transação Ticto: o estorno financeiro deve ser feito manualmente no painel da Ticto. Apenas o downgrade será aplicado.
                      </p>
                    )}
                  </div>
                )}
                <p className="text-destructive font-medium">
                  O usuário será rebaixado para o plano Free (créditos zerados).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRefunding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              disabled={isRefunding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRefunding ? 'Processando...' : 'Confirmar Reembolso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
