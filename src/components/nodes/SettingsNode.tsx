import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Settings, Sparkles, Copy, Trash2, Square, RectangleVertical, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SettingsNodeData {
  label: string;
  aspectRatio: string;
  quantity: number;
  onGenerate?: () => void;
}

const aspectRatios = [
  { value: '1:1', label: '1:1', icon: Square },
  { value: '4:5', label: '4:5', icon: RectangleVertical },
  { value: '9:16', label: '9:16', icon: Smartphone },
  { value: '16:9', label: '16:9', icon: RectangleVertical },
];

export const SettingsNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as SettingsNodeData;
  const [aspectRatio, setAspectRatio] = useState(nodeData.aspectRatio || '1:1');
  const { profile } = useAuth();
  const { deleteElements, setNodes, getNodes } = useReactFlow();

  const handleAspectChange = (value: string) => {
    setAspectRatio(value);
    (data as Record<string, unknown>).aspectRatio = value;
  };

  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  const handleDuplicate = () => {
    const nodes = getNodes();
    const currentNode = nodes.find(n => n.id === id);
    if (currentNode) {
      const newNode = {
        ...currentNode,
        id: `settings-${Date.now()}`,
        position: {
          x: currentNode.position.x + 50,
          y: currentNode.position.y + 50,
        },
        data: { ...currentNode.data },
      };
      setNodes([...nodes, newNode]);
    }
  };

  const creditsNeeded = 1; // Always 1 image
  const credits = profile?.credits || 0;

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-2xl min-w-[300px] shadow-xl">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-violet-500 !border-4 !border-background !-left-2"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
            <Settings className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Configurações</h3>
            <p className="text-xs text-muted-foreground">Configure a saída</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Aspect Ratio */}
        <div className="space-y-3">
          <label className="text-sm text-muted-foreground">Proporção</label>
          <div className="grid grid-cols-4 gap-2">
            {aspectRatios.map((ar) => {
              const Icon = ar.icon;
              return (
                <button
                  key={ar.value}
                  onClick={() => handleAspectChange(ar.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                    aspectRatio === ar.value
                      ? "bg-violet-500/20 border-violet-500 text-violet-400"
                      : "bg-muted/30 border-border/50 text-muted-foreground hover:border-border"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5",
                    ar.value === '16:9' && "rotate-90"
                  )} />
                  <span className="text-xs font-medium">{ar.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold shadow-lg shadow-violet-500/25"
          onClick={() => nodeData.onGenerate?.()}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Gerar ({creditsNeeded} créditos)
        </Button>
        
        <p className="text-center text-xs text-muted-foreground">
          {credits} créditos disponíveis
        </p>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-violet-500 !border-4 !border-background !-right-2"
      />
    </div>
  );
});

SettingsNode.displayName = 'SettingsNode';
