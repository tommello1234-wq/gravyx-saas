import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SettingsNodeData {
  label: string;
  aspectRatio: string;
  quantity: number;
  onGenerate?: () => void;
}

const aspectRatios = [
  { value: '1:1', label: '1:1 (Quadrado)' },
  { value: '4:5', label: '4:5 (Retrato)' },
  { value: '9:16', label: '9:16 (Stories)' },
  { value: '16:9', label: '16:9 (Paisagem)' },
];

const quantities = [
  { value: 1, label: '1 imagem' },
  { value: 2, label: '2 imagens' },
  { value: 4, label: '4 imagens' },
];

export const SettingsNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as SettingsNodeData;
  const [aspectRatio, setAspectRatio] = useState(nodeData.aspectRatio || '1:1');
  const [quantity, setQuantity] = useState(nodeData.quantity || 1);

  const handleAspectChange = (value: string) => {
    setAspectRatio(value);
    (data as Record<string, unknown>).aspectRatio = value;
  };

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value);
    setQuantity(num);
    (data as Record<string, unknown>).quantity = num;
  };

  return (
    <div className="glass-card node-settings min-w-[240px] p-4">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-node-settings !border-2 !border-background"
      />
      
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4 text-node-settings" />
        <span className="font-medium text-sm">Configurações</span>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Proporção</Label>
          <Select value={aspectRatio} onValueChange={handleAspectChange}>
            <SelectTrigger className="bg-muted/50 border-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aspectRatios.map((ar) => (
                <SelectItem key={ar.value} value={ar.value}>
                  {ar.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">Quantidade</Label>
          <Select value={quantity.toString()} onValueChange={handleQuantityChange}>
            <SelectTrigger className="bg-muted/50 border-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quantities.map((q) => (
                <SelectItem key={q.value} value={q.value.toString()}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-node-settings !border-2 !border-background"
      />
    </div>
  );
});

SettingsNode.displayName = 'SettingsNode';
