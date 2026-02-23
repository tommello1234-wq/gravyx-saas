import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, MoreVertical, Copy, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GravityPopup } from './GravityPopup';
import gravityLogo from '@/assets/gravity-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ResultNodeData } from './ResultNode';

export const GENERATE_ALL_FROM_GRAVITY_EVENT = 'editor:generate-all-from-gravity';
export const GRAVITY_GENERATING_STATE_EVENT = 'editor:gravity-generating-state';

export interface GravityNodeData { label: string; internalPrompt: string; internalMediaUrls: string[]; }
interface GeneratingState { gravityId: string; isGenerating: boolean; totalResults: number; completedResults: number; }

export const GravityNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as GravityNodeData;
  const [label, setLabel] = useState(nodeData.label || 'Gravity');
  const [isEditing, setIsEditing] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [generatingState, setGeneratingState] = useState<Omit<GeneratingState, 'gravityId'>>({ isGenerating: false, totalResults: 0, completedResults: 0 });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [totalImages, setTotalImages] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes, setEdges, getNode, getEdges, getNodes } = useReactFlow();
  const { profile, isAdmin } = useAuth();
  const { t } = useLanguage();
  const hasActiveSubscription = isAdmin || profile?.subscription_status === 'active';

  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);
  useEffect(() => { const handler = (e: CustomEvent<GeneratingState>) => { if (e.detail.gravityId === id) setGeneratingState({ isGenerating: e.detail.isGenerating, totalResults: e.detail.totalResults, completedResults: e.detail.completedResults }); }; window.addEventListener(GRAVITY_GENERATING_STATE_EVENT, handler as EventListener); return () => window.removeEventListener(GRAVITY_GENERATING_STATE_EVENT, handler as EventListener); }, [id]);

  const connectedResultCount = useCallback(() => { const edges = getEdges(); const nodes = getNodes(); return edges.filter(e => e.source === id).filter(e => nodes.find(n => n.id === e.target)?.type === 'result').length; }, [id, getEdges, getNodes]);

  const calculateTotalImages = useCallback(() => {
    const edges = getEdges(); const nodes = getNodes();
    let total = 0;
    for (const edge of edges.filter(e => e.source === id)) { const targetNode = nodes.find(n => n.id === edge.target); if (targetNode?.type === 'result') { total += (targetNode.data as unknown as ResultNodeData).quantity || 1; } }
    return total;
  }, [id, getEdges, getNodes]);

  const handleReset = useCallback(() => { setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, internalPrompt: '', internalMediaUrls: [] } } : n)); setEdges(edges => edges.filter(e => e.source !== id && e.target !== id)); }, [id, setNodes, setEdges]);
  const handleDuplicate = useCallback(() => { const currentNode = getNode(id); if (!currentNode) return; const currentEdges = getEdges(); const newId = `${currentNode.type}-${Date.now()}`; const newNode = { ...currentNode, id: newId, position: { x: currentNode.position.x + 50, y: currentNode.position.y + 50 }, selected: false, data: { ...currentNode.data } }; const connectedEdges = currentEdges.filter(e => e.source === id || e.target === id); const newEdges = connectedEdges.map((edge, i) => ({ ...edge, id: `edge-dup-${Date.now()}-${i}`, source: edge.source === id ? newId : edge.source, target: edge.target === id ? newId : edge.target })); setNodes(nds => [...nds, newNode]); setEdges(eds => [...eds, ...newEdges]); }, [id, getNode, getEdges, setNodes, setEdges]);
  const handleDelete = useCallback(() => { setNodes(nds => nds.filter(n => n.id !== id)); setEdges(eds => eds.filter(e => e.source !== id && e.target !== id)); }, [id, setNodes, setEdges]);
  const handleLabelChange = useCallback((newLabel: string) => { setLabel(newLabel); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n)); }, [id, setNodes]);
  const handleLabelKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') setIsEditing(false); else if (e.key === 'Escape') { setLabel(nodeData.label || 'Gravity'); setIsEditing(false); } };
  const handlePopupSave = useCallback((prompt: string, mediaUrls: string[]) => { setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, internalPrompt: prompt, internalMediaUrls: mediaUrls } } : n)); }, [id, setNodes]);
  const handleGenerateAllClick = () => { setTotalImages(calculateTotalImages()); setIsConfirmOpen(true); };
  const handleConfirmGenerate = () => { setIsConfirmOpen(false); window.dispatchEvent(new CustomEvent(GENERATE_ALL_FROM_GRAVITY_EVENT, { detail: { gravityId: id } })); };

  const resultCount = connectedResultCount();
  const hasContent = (nodeData.internalPrompt?.length > 0) || (nodeData.internalMediaUrls?.length > 0);
  const isGenerating = generatingState.isGenerating;

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Handle type="target" position={Position.Left} className="!w-4 !h-4 !border-4 !border-card !-left-2 !shadow-lg !top-1/2 !-translate-y-1/2" style={{ background: 'linear-gradient(135deg, #0087ff, #001eff)' }} />
          <div className={cn("w-24 h-24 rounded-full cursor-pointer transition-all duration-300 bg-background flex items-center justify-center hover:scale-105", hasContent && "ring-2 ring-offset-2 ring-offset-card")}
            style={{ border: '3px solid transparent', backgroundImage: `linear-gradient(hsl(var(--background)), hsl(var(--background))), linear-gradient(135deg, #0087ff, #001eff)`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box', boxShadow: '0 0 20px rgba(0, 135, 255, 0.3), 0 0 40px rgba(0, 30, 255, 0.15)', ...(hasContent ? { '--tw-ring-color': '#0087ff' } as React.CSSProperties : {}) }}
            onClick={() => setIsPopupOpen(true)}>
            <img src={gravityLogo} alt="Gravity" className="w-14 h-14 object-contain" />
          </div>
          <Handle type="source" position={Position.Right} className="!w-4 !h-4 !border-4 !border-card !-right-2 !shadow-lg !top-1/2 !-translate-y-1/2" style={{ background: 'linear-gradient(135deg, #0087ff, #001eff)' }} />
          <div className="absolute -top-1 -right-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-card/90 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"><MoreVertical className="h-3 w-3" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleDuplicate}><Copy className="h-4 w-4 mr-2" />{t('editor.duplicate')}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleReset}><RotateCcw className="h-4 w-4 mr-2" />{t('editor.reset')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="h-4 w-4 mr-2" />{t('editor.rename')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />{t('editor.delete')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="text-center">
          {isEditing ? <Input ref={inputRef} value={label} onChange={e => handleLabelChange(e.target.value)} onBlur={() => setIsEditing(false)} onKeyDown={handleLabelKeyDown} className="h-7 w-24 text-sm font-semibold bg-card border-border/50 text-center" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} /> : (
            <><h3 className="font-semibold text-sm text-foreground">{label}</h3><p className="text-xs text-muted-foreground">{resultCount > 0 ? `${resultCount} ${resultCount > 1 ? t('editor.results_plural') : t('editor.results')}` : t('editor.click_to_edit')}</p></>
          )}
        </div>
        {resultCount > 0 && (
          <Button size="sm" className={cn("rounded-xl px-4 h-9 font-medium shadow-lg transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed")} style={{ background: 'linear-gradient(135deg, #0087ff, #001eff)', boxShadow: '0 4px 15px rgba(0, 135, 255, 0.3)' }} onClick={handleGenerateAllClick} disabled={isGenerating || !hasActiveSubscription}>
            {isGenerating ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{generatingState.completedResults}/{generatingState.totalResults}</> : <><Sparkles className="h-4 w-4 mr-1.5" />{t('editor.generate_all')}</>}
          </Button>
        )}
      </div>
      <GravityPopup isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)} initialPrompt={nodeData.internalPrompt || ''} initialMediaUrls={nodeData.internalMediaUrls || []} onSave={handlePopupSave} />
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editor.confirm_generation')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p>{t('editor.confirm_generation_desc').replace('{images}', String(totalImages)).replace('{images_label}', totalImages === 1 ? t('editor.image') : t('editor.images')).replace('{credits}', String(totalImages)).replace('{credits_label}', totalImages === 1 ? t('editor.credit') : t('editor.credits'))}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate}>{t('editor.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
GravityNode.displayName = 'GravityNode';
