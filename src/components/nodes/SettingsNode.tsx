import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Settings, Sparkles, Pencil, RotateCcw, Square, RectangleVertical, Smartphone, Loader2, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { GENERATE_IMAGE_EVENT } from '@/pages/Editor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SettingsNodeData {
  label: string;
  aspectRatio: string;
  quantity: number;
}

const aspectRatios = [{
  value: '1:1',
  label: '1:1',
  icon: Square
}, {
  value: '4:5',
  label: '4:5',
  icon: RectangleVertical
}, {
  value: '9:16',
  label: '9:16',
  icon: Smartphone
}, {
  value: '16:9',
  label: '16:9',
  icon: RectangleVertical
}];

const quantities = [1, 2, 4];

const CREDITS_PER_IMAGE = 1;

// Event for loading state
export const GENERATING_STATE_EVENT = 'editor:generating-state';

// Event for job queue state updates
export const JOB_QUEUE_STATE_EVENT = 'editor:job-queue-state';

interface JobQueueState {
  hasQueuedJobs: boolean;
  hasProcessingJobs: boolean;
  totalPendingImages: number;
}

export const SettingsNode = memo(({
  data,
  id
}: NodeProps) => {
  const nodeData = data as unknown as SettingsNodeData;
  const [aspectRatio, setAspectRatio] = useState(nodeData.aspectRatio || '1:1');
  const [quantity, setQuantity] = useState(nodeData.quantity || 1);
  const [label, setLabel] = useState(nodeData.label || 'Configurações');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobQueueState, setJobQueueState] = useState<JobQueueState>({
    hasQueuedJobs: false,
    hasProcessingJobs: false,
    totalPendingImages: 0
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow();

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Listen for generating state events
  useEffect(() => {
    const handler = (e: CustomEvent<{ isGenerating: boolean }>) => {
      setIsGenerating(e.detail.isGenerating);
    };
    
    window.addEventListener(GENERATING_STATE_EVENT, handler as EventListener);
    return () => window.removeEventListener(GENERATING_STATE_EVENT, handler as EventListener);
  }, []);

  // Listen for job queue state events
  useEffect(() => {
    const handler = (e: CustomEvent<JobQueueState>) => {
      setJobQueueState(e.detail);
    };
    
    window.addEventListener(JOB_QUEUE_STATE_EVENT, handler as EventListener);
    return () => window.removeEventListener(JOB_QUEUE_STATE_EVENT, handler as EventListener);
  }, []);

  const handleAspectChange = useCallback((value: string) => {
    setAspectRatio(value);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, aspectRatio: value } }
          : node
      )
    );
  }, [id, setNodes]);

  const handleQuantityChange = useCallback((value: number) => {
    setQuantity(value);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, quantity: value } }
          : node
      )
    );
  }, [id, setNodes]);

  const handleReset = useCallback(() => {
    setAspectRatio('1:1');
    setQuantity(1);
    setNodes(nodes => nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, aspectRatio: '1:1', quantity: 1 } } : n
    ));
    setEdges(edges => edges.filter(e => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const handleDuplicate = useCallback(() => {
    const currentNode = getNode(id);
    if (!currentNode) return;
    
    const currentEdges = getEdges();
    const newId = `${currentNode.type}-${Date.now()}`;
    const newNode = {
      ...currentNode,
      id: newId,
      position: { x: currentNode.position.x + 50, y: currentNode.position.y + 50 },
      selected: false,
      data: { ...currentNode.data }
    };
    
    // Recreate edges connected to this node
    const connectedEdges = currentEdges.filter(e => e.source === id || e.target === id);
    const newEdges = connectedEdges.map((edge, i) => ({
      ...edge,
      id: `edge-dup-${Date.now()}-${i}`,
      source: edge.source === id ? newId : edge.source,
      target: edge.target === id ? newId : edge.target,
    }));
    
    setNodes(nds => [...nds, newNode]);
    setEdges(eds => [...eds, ...newEdges]);
  }, [id, getNode, getEdges, setNodes, setEdges]);

  const handleDelete = useCallback(() => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const handleLabelChange = useCallback((newLabel: string) => {
    setLabel(newLabel);
    setNodes(nodes => nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
    ));
  }, [id, setNodes]);

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setLabel(nodeData.label || 'Configurações');
      setIsEditing(false);
    }
  };

  const creditsNeeded = quantity * CREDITS_PER_IMAGE;
  const credits = profile?.credits || 0;
  const hasEnoughCredits = credits >= creditsNeeded;

  return <div className="bg-card border border-slate-500/30 rounded-2xl min-w-[300px] shadow-2xl shadow-slate-500/10">
      <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-gradient-to-br !from-violet-500 !to-purple-600 !border-4 !border-card !-left-2 !shadow-lg" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-slate-500/10 to-transparent rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-500/30">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            {isEditing ? (
              <Input
                ref={inputRef}
                value={label}
                onChange={e => handleLabelChange(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={handleLabelKeyDown}
                className="h-7 w-32 text-sm font-semibold bg-muted/50 border-border/50"
                onMouseDown={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              />
            ) : (
              <h3 className="font-semibold text-primary-foreground">{label}</h3>
            )}
            <p className="text-xs text-muted-foreground">Configure a saída</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5">
        {/* Aspect Ratio */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Proporção</label>
          <div className="grid grid-cols-4 gap-2">
            {aspectRatios.map(ar => {
            const Icon = ar.icon;
            return <button key={ar.value} onClick={() => handleAspectChange(ar.value)} className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all', aspectRatio === ar.value ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20' : 'bg-muted/20 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40')}>
                  <Icon className={cn('h-5 w-5', ar.value === '16:9' && 'rotate-90')} />
                  <span className="text-xs font-medium">{ar.label}</span>
                </button>;
          })}
          </div>
        </div>

        {/* Quantity */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Quantidade de imagens</label>
          <div className="grid grid-cols-3 gap-2">
            {quantities.map(q => (
              <button 
                key={q} 
                onClick={() => handleQuantityChange(q)} 
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                  quantity === q 
                    ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20' 
                    : 'bg-muted/20 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40'
                )}
              >
                <span className="text-lg font-bold">{q}</span>
                <span className="text-xs">{q === 1 ? 'imagem' : 'imagens'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 hover:from-violet-500 hover:via-purple-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed" 
          onClick={() => window.dispatchEvent(new CustomEvent(GENERATE_IMAGE_EVENT))}
          disabled={!hasEnoughCredits || isGenerating || jobQueueState.hasQueuedJobs || jobQueueState.hasProcessingJobs}
        >
          {jobQueueState.hasProcessingJobs ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Gerando {jobQueueState.totalPendingImages} {jobQueueState.totalPendingImages === 1 ? 'imagem' : 'imagens'}...
            </>
          ) : jobQueueState.hasQueuedJobs ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Na fila ({jobQueueState.totalPendingImages})...
            </>
          ) : isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Gerar {quantity} {quantity === 1 ? 'Imagem' : 'Imagens'}
            </>
          )}
        </Button>

        <p className={cn(
          "text-center text-xs",
          hasEnoughCredits ? "text-muted-foreground" : "text-destructive"
        )}>
          {creditsNeeded} {creditsNeeded === 1 ? 'crédito' : 'créditos'} por geração • {credits} disponíveis
        </p>
      </div>

      <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-gradient-to-br !from-violet-500 !to-purple-600 !border-4 !border-card !-right-2 !shadow-lg" />
    </div>;
});
SettingsNode.displayName = 'SettingsNode';
