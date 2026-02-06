import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Settings, Sparkles, Copy, Trash2, Square, RectangleVertical, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { GENERATE_IMAGE_EVENT } from '@/pages/Editor';

interface SettingsNodeData {
  label: string;
  aspectRatio: string;
  quantity: number;
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
    const currentNode = nodes.find((n) => n.id === id);
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

  const creditsNeeded = 1;
  const credits = profile?.credits || 0;

  return (
    <div className="bg-card border border-slate-500/30 rounded-2xl min-w-[300px] shadow-2xl shadow-slate-500/10">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-gradient-to-br !from-violet-500 !to-purple-600 !border-4 !border-card !-left-2 !shadow-lg"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-slate-500/10 to-transparent rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-500/30">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Configurações</h3>
            <p className="text-xs text-muted-foreground">Configure a saída</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={handleDuplicate}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Aspect Ratio */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Proporção</label>
          <div className="grid grid-cols-4 gap-2">
            {aspectRatios.map((ar) => {
              const Icon = ar.icon;
              return (
                <button
                  key={ar.value}
                  onClick={() => handleAspectChange(ar.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all',
                    aspectRatio === ar.value
                      ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20'
                      : 'bg-muted/20 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40'
                  )}
                >
                  <Icon className={cn('h-5 w-5', ar.value === '16:9' && 'rotate-90')} />
                  <span className="text-xs font-medium">{ar.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 hover:from-violet-500 hover:via-purple-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40"
          onClick={() => window.dispatchEvent(new CustomEvent(GENERATE_IMAGE_EVENT))}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Gerar Imagem
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {creditsNeeded} crédito por geração • {credits} disponíveis
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-gradient-to-br !from-violet-500 !to-purple-600 !border-4 !border-card !-right-2 !shadow-lg"
      />
    </div>
  );
});

SettingsNode.displayName = 'SettingsNode';