import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export interface CostConfig {
  costPerImage: number;
  paymentFeePercent: number;
  taxPercent: number;
  otherVariableCosts: number;
  fixedCosts: { name: string; value: number }[];
}

const DEFAULT_COSTS: CostConfig = {
  costPerImage: 0.30,
  paymentFeePercent: 0,
  taxPercent: 0,
  otherVariableCosts: 0,
  fixedCosts: [],
};

function loadCosts(): CostConfig {
  try {
    const saved = localStorage.getItem('gravyx-admin-costs');
    if (saved) return { ...DEFAULT_COSTS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_COSTS;
}

function saveCosts(config: CostConfig) {
  localStorage.setItem('gravyx-admin-costs', JSON.stringify(config));
}

function formatBRL(val: number) {
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CostsManagerProps {
  costs: CostConfig;
  onCostsChange: (c: CostConfig) => void;
  periodImages: number;
  periodRevenue: number; // centavos
}

export function useCostConfig() {
  const [costs, setCosts] = useState<CostConfig>(loadCosts);

  const updateCosts = (newCosts: CostConfig) => {
    setCosts(newCosts);
    saveCosts(newCosts);
  };

  return { costs, updateCosts };
}

export function calculateTotalCosts(costs: CostConfig, periodImages: number, periodRevenue: number) {
  const variableImageCost = periodImages * costs.costPerImage * 100; // centavos
  const paymentFee = periodRevenue * (costs.paymentFeePercent / 100);
  const tax = periodRevenue * (costs.taxPercent / 100);
  const otherVar = costs.otherVariableCosts * 100;
  const totalVariable = variableImageCost + paymentFee + tax + otherVar;
  const totalFixed = costs.fixedCosts.reduce((s, f) => s + f.value * 100, 0);
  return { variableImageCost, paymentFee, tax, otherVar, totalVariable, totalFixed, total: totalVariable + totalFixed };
}

export function CostsManager({ costs, onCostsChange, periodImages, periodRevenue }: CostsManagerProps) {
  const [open, setOpen] = useState(false);
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedValue, setNewFixedValue] = useState('');

  const update = (partial: Partial<CostConfig>) => {
    onCostsChange({ ...costs, ...partial });
  };

  const addFixedCost = () => {
    if (!newFixedName || !newFixedValue) return;
    update({ fixedCosts: [...costs.fixedCosts, { name: newFixedName, value: parseFloat(newFixedValue) || 0 }] });
    setNewFixedName('');
    setNewFixedValue('');
  };

  const removeFixedCost = (index: number) => {
    update({ fixedCosts: costs.fixedCosts.filter((_, i) => i !== index) });
  };

  const breakdown = calculateTotalCosts(costs, periodImages, periodRevenue);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="glass-card">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Gestão de Custos</span>
              <span className="text-xs text-muted-foreground ml-2">Total: {formatBRL(breakdown.total / 100)}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-5 space-y-5">
            {/* Variable Costs */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Custos Variáveis</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs">Custo por imagem (R$)</Label>
                  <Input type="number" step="0.01" value={costs.costPerImage} onChange={e => update({ costPerImage: parseFloat(e.target.value) || 0 })} className="h-9 mt-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">{periodImages} imgs = {formatBRL(breakdown.variableImageCost / 100)}</p>
                </div>
                <div>
                  <Label className="text-xs">Taxa plataforma (%)</Label>
                  <Input type="number" step="0.1" value={costs.paymentFeePercent} onChange={e => update({ paymentFeePercent: parseFloat(e.target.value) || 0 })} className="h-9 mt-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">= {formatBRL(breakdown.paymentFee / 100)}</p>
                </div>
                <div>
                  <Label className="text-xs">Imposto (%)</Label>
                  <Input type="number" step="0.1" value={costs.taxPercent} onChange={e => update({ taxPercent: parseFloat(e.target.value) || 0 })} className="h-9 mt-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">= {formatBRL(breakdown.tax / 100)}</p>
                </div>
                <div>
                  <Label className="text-xs">Outros variáveis (R$/mês)</Label>
                  <Input type="number" step="1" value={costs.otherVariableCosts} onChange={e => update({ otherVariableCosts: parseFloat(e.target.value) || 0 })} className="h-9 mt-1" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Subtotal variáveis: <span className="font-medium text-foreground">{formatBRL(breakdown.totalVariable / 100)}</span>
              </div>
            </div>

            <Separator />

            {/* Fixed Costs */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Custos Fixos Mensais</h4>
              <div className="space-y-2">
                {costs.fixedCosts.map((fc, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{fc.name}</span>
                    <span className="text-sm font-medium">{formatBRL(fc.value)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeFixedCost(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input placeholder="Nome (ex: Supabase)" value={newFixedName} onChange={e => setNewFixedName(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="w-28">
                    <Input type="number" placeholder="R$ valor" value={newFixedValue} onChange={e => setNewFixedValue(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={addFixedCost}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Subtotal fixos: <span className="font-medium text-foreground">{formatBRL(breakdown.totalFixed / 100)}</span>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total de Custos</span>
              <span className="text-lg font-bold text-red-400">{formatBRL(breakdown.total / 100)}</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
