import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Type, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PromptNodeData {
  label: string;
  value: string;
}

export const PromptNode = memo(({
  data,
  id
}: NodeProps) => {
  const nodeData = data as unknown as PromptNodeData;
  const [value, setValue] = useState(nodeData.value || '');
  const [label, setLabel] = useState(nodeData.label || 'Prompt');
  const [isEditing, setIsEditing] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    setNodes,
    setEdges
  } = useReactFlow();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleReset = useCallback(() => {
    setValue('');
    setNodes(nodes => nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, value: '' } } : n
    ));
    setEdges(edges => edges.filter(e => e.source !== id && e.target !== id));
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
      setLabel(nodeData.label || 'Prompt');
      setIsEditing(false);
    }
  };

  // Debounced update - instant local state, delayed global flow update
  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue); // Instant UI update
    
    // Debounce the global flow update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, value: newValue } }
            : node
        )
      );
    }, 500); // 500ms debounce
  }, [id, setNodes]);

  return <div className="bg-card border border-amber-500/30 rounded-2xl min-w-[320px] shadow-2xl shadow-amber-500/10 nodrag-content">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-amber-500/10 to-transparent rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Type className="h-5 w-5 text-white" />
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
            <p className="text-xs text-muted-foreground">Descreva sua imagem</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={handleReset} title="Resetar">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={() => setIsEditing(true)} title="Renomear">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Textarea value={value} onChange={e => handleValueChange(e.target.value)} placeholder="Descreva a imagem que você quer criar..." className="min-h-[120px] bg-muted/20 border-border/30 resize-none text-sm rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 placeholder:text-muted-foreground/50 nodrag" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} />
      </div>

      <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-gradient-to-br !from-amber-500 !to-orange-600 !border-4 !border-card !-right-2 !shadow-lg" />
    </div>;
});
PromptNode.displayName = 'PromptNode';
