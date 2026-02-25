import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Pencil, Save, Tag, DollarSign } from 'lucide-react';

// ---- Types ----
interface PlanPricing {
  id: string;
  tier: string;
  cycle: string;
  price: number;
  credits: number;
  max_projects: number;
  active: boolean;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  valid_until: string | null;
  allowed_tiers: string[] | null;
  allowed_cycles: string[] | null;
  active: boolean;
  created_at: string;
}

// ---- Helpers ----
const formatBRL = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const tierLabels: Record<string, string> = {
  starter: 'Starter', premium: 'Premium', enterprise: 'Enterprise',
};
const cycleLabels: Record<string, string> = { monthly: 'Mensal', annual: 'Anual' };

// ==================== COMPONENT ====================
export function PricingTab() {
  return (
    <>
      <AdminTopbar title="Preços & Cupons" />
      <div className="p-6">
        <Tabs defaultValue="pricing" className="space-y-6">
          <TabsList className="bg-muted/30 border border-border/40">
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" /> Preços dos Planos
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2">
              <Tag className="h-4 w-4" /> Cupons de Desconto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pricing"><PricingSection /></TabsContent>
          <TabsContent value="coupons"><CouponsSection /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// ==================== PRICING SECTION ====================
function PricingSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, Partial<PlanPricing>>>({});

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin-plan-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_pricing')
        .select('*')
        .order('tier')
        .order('cycle');
      if (error) throw error;
      return data as PlanPricing[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (plan: PlanPricing) => {
      const { error } = await supabase
        .from('plan_pricing')
        .update({
          price: plan.price,
          credits: plan.credits,
          max_projects: plan.max_projects,
          active: plan.active,
        })
        .eq('id', plan.id);
      if (error) throw error;
    },
    onSuccess: (_, plan) => {
      queryClient.invalidateQueries({ queryKey: ['admin-plan-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['plan-pricing'] });
      setEditing(prev => { const n = { ...prev }; delete n[plan.id]; return n; });
      toast({ title: 'Preço atualizado!' });
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const getEditValue = (plan: PlanPricing) => ({
    ...plan,
    ...(editing[plan.id] || {}),
  });

  const setField = (id: string, field: string, value: number | boolean) => {
    setEditing(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg">Preços dos Planos</CardTitle>
        <p className="text-sm text-muted-foreground">Edite os valores inline e clique em salvar. Preços em centavos (7900 = R$79,00).</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Preço (centavos)</TableHead>
              <TableHead>Exibição</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Max Projetos</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-[80px]">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map(plan => {
              const v = getEditValue(plan);
              const isDirty = !!editing[plan.id];
              return (
                <TableRow key={plan.id}>
                  <TableCell><Badge variant="outline">{tierLabels[plan.tier] || plan.tier}</Badge></TableCell>
                  <TableCell className="text-sm">{cycleLabels[plan.cycle] || plan.cycle}</TableCell>
                  <TableCell>
                    <Input type="number" value={v.price} className="w-28 h-8 bg-muted/30 border-border/40"
                      onChange={e => setField(plan.id, 'price', parseInt(e.target.value) || 0)} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatBRL(v.price)}</TableCell>
                  <TableCell>
                    <Input type="number" value={v.credits} className="w-24 h-8 bg-muted/30 border-border/40"
                      onChange={e => setField(plan.id, 'credits', parseInt(e.target.value) || 0)} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={v.max_projects} className="w-20 h-8 bg-muted/30 border-border/40"
                      onChange={e => setField(plan.id, 'max_projects', parseInt(e.target.value) || -1)} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={v.active} onCheckedChange={val => setField(plan.id, 'active', val)} />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!isDirty || updateMutation.isPending}
                      onClick={() => updateMutation.mutate(v as PlanPricing)}>
                      {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ==================== COUPONS SECTION ====================
function CouponsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [form, setForm] = useState({
    code: '', discount_type: 'percent', discount_value: '', max_uses: '',
    valid_until: '', allowed_tiers: [] as string[], allowed_cycles: [] as string[],
  });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase().trim(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        valid_until: form.valid_until || null,
        allowed_tiers: form.allowed_tiers.length > 0 ? form.allowed_tiers : null,
        allowed_cycles: form.allowed_cycles.length > 0 ? form.allowed_cycles : null,
      };
      if (selected) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', selected.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setDialogOpen(false);
      toast({ title: selected ? 'Cupom atualizado!' : 'Cupom criado!' });
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('coupons').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      setDeleteOpen(false); setSelected(null);
      toast({ title: 'Cupom excluído!' });
    },
    onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const openNew = () => {
    setSelected(null);
    setForm({ code: '', discount_type: 'percent', discount_value: '', max_uses: '', valid_until: '', allowed_tiers: [], allowed_cycles: [] });
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setSelected(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      max_uses: c.max_uses != null ? String(c.max_uses) : '',
      valid_until: c.valid_until ? c.valid_until.split('T')[0] : '',
      allowed_tiers: c.allowed_tiers || [],
      allowed_cycles: c.allowed_cycles || [],
    });
    setDialogOpen(true);
  };

  const toggleTier = (t: string) => setForm(prev => ({
    ...prev,
    allowed_tiers: prev.allowed_tiers.includes(t) ? prev.allowed_tiers.filter(x => x !== t) : [...prev.allowed_tiers, t],
  }));

  const toggleCycle = (c: string) => setForm(prev => ({
    ...prev,
    allowed_cycles: prev.allowed_cycles.includes(c) ? prev.allowed_cycles.filter(x => x !== c) : [...prev.allowed_cycles, c],
  }));

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <>
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Cupons de Desconto</CardTitle>
          <Button size="sm" className="rounded-full" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo Cupom
          </Button>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cupom criado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map(c => (
                  <TableRow key={c.id}>
                    <TableCell><code className="text-primary font-mono font-bold">{c.code}</code></TableCell>
                    <TableCell className="text-sm">
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : formatBRL(c.discount_value)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.current_uses}{c.max_uses != null ? `/${c.max_uses}` : ' / ∞'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.valid_until ? new Date(c.valid_until).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.allowed_tiers ? c.allowed_tiers.map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{tierLabels[t] || t}</Badge>
                        )) : <span className="text-xs text-muted-foreground">Todos</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.active} onCheckedChange={val => toggleActiveMutation.mutate({ id: c.id, active: val })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelected(c); setDeleteOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GRAVYX20" className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de desconto</Label>
                <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (centavos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.discount_type === 'percent' ? 'Valor (%)' : 'Valor (centavos)'}</Label>
                <Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === 'percent' ? '20' : '5000'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Limite de usos</Label>
                <Input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} placeholder="Ilimitado" />
              </div>
              <div>
                <Label>Validade até</Label>
                <Input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tiers permitidos <span className="text-muted-foreground text-xs">(vazio = todos)</span></Label>
              <div className="flex gap-2 mt-1">
                {['starter', 'premium', 'enterprise'].map(t => (
                  <Badge key={t} variant={form.allowed_tiers.includes(t) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggleTier(t)}>
                    {tierLabels[t]}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Ciclos permitidos <span className="text-muted-foreground text-xs">(vazio = todos)</span></Label>
              <div className="flex gap-2 mt-1">
                {['monthly', 'annual'].map(c => (
                  <Badge key={c} variant={form.allowed_cycles.includes(c) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggleCycle(c)}>
                    {cycleLabels[c]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.discount_value}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selected ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>O cupom <strong>{selected?.code}</strong> será excluído permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selected && deleteMutation.mutate(selected.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
