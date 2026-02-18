import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Type, MoreVertical, Copy, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PromptNodeData { label: string; value: string; }

export const PromptNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as PromptNodeData;
  const [value, setValue] = useState(nodeData.value || '');
  const [label, setLabel] = useState(nodeData.label || 'Prompt');
  const [isEditing, setIsEditing] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow();
  const { t } = useLanguage();

  useEffect(() => { return () => { if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current); }; }, []);
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleReset = useCallback(() => {
    setValue('');
    setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, value: '' } } : n));
    setEdges(edges => edges.filter(e => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const handleDuplicate = useCallback(() => {
    const currentNode = getNode(id); if (!currentNode) return;
    const currentEdges = getEdges();
    const newId = `${currentNode.type}-${Date.now()}`;
    const newNode = { ...currentNode, id: newId, position: { x: currentNode.position.x + 50, y: currentNode.position.y + 50 }, selected: false, data: { ...currentNode.data } };
    const connectedEdges = currentEdges.filter(e => e.source === id || e.target === id);
    const newEdges = connectedEdges.map((edge, i) => ({ ...edge, id: `edge-dup-${Date.now()}-${i}`, source: edge.source === id ? newId : edge.source, target: edge.target === id ? newId : edge.target }));
    setNodes(nds => [...nds, newNode]); setEdges(eds => [...eds, ...newEdges]);
  }, [id, getNode, getEdges, setNodes, setEdges]);

  const handleDelete = useCallback(() => { setNodes(nds => nds.filter(n => n.id !== id)); setEdges(eds => eds.filter(e => e.source !== id && e.target !== id)); }, [id, setNodes, setEdges]);

  const handleLabelChange = useCallback((newLabel: string) => { setLabel(newLabel); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n)); }, [id, setNodes]);

  const handleLabelKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') setIsEditing(false); else if (e.key === 'Escape') { setLabel(nodeData.label || 'Prompt'); setIsEditing(false); } };

  const handleValueChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => { setNodes((nodes) => nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, value: newValue } } : node)); }, 500);
  }, [id, setNodes]);

  return <div className="bg-card border border-amber-500/30 rounded-2xl min-w-[320px] shadow-2xl shadow-amber-500/10 nodrag-content">
    <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-amber-500/10 to-transparent rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30"><Type className="h-5 w-5 text-white" /></div>
        <div>
          {isEditing ? (
            <Input ref={inputRef} value={label} onChange={e => handleLabelChange(e.target.value)} onBlur={() => setIsEditing(false)} onKeyDown={handleLabelKeyDown} className="h-7 w-32 text-sm font-semibold bg-muted/50 border-border/50" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} />
          ) : (
            <h3 className="font-semibold text-primary-foreground">{label}</h3>
          )}
          <p className="text-xs text-muted-foreground">{t('editor.describe_image')}</p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={handleDuplicate}><Copy className="h-4 w-4 mr-2" />{t('editor.duplicate')}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleReset}><RotateCcw className="h-4 w-4 mr-2" />{t('editor.reset')}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="h-4 w-4 mr-2" />{t('editor.rename')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />{t('editor.delete')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="p-4">
      <Textarea value={value} onChange={e => handleValueChange(e.target.value)} placeholder={t('editor.describe_placeholder')} className="min-h-[120px] bg-muted/20 border-border/30 resize-none text-sm rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 placeholder:text-muted-foreground/50 nodrag" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} />
    </div>
    <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-gradient-to-br !from-amber-500 !to-orange-600 !border-4 !border-card !-right-2 !shadow-lg" />
  </div>;
});
PromptNode.displayName = 'PromptNode';
