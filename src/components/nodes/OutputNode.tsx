import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Download, Pencil, RotateCcw, MoreVertical, Copy, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OutputImageModal, NodeImage } from './OutputImageModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { GENERATE_IMAGE_EVENT } from '@/pages/Editor';
import { GENERATING_STATE_EVENT, JOB_QUEUE_STATE_EVENT } from './SettingsNode';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface OutputNodeData {
  label: string;
  images: NodeImage[] | string[];
  aspectRatio?: string;
  quantity?: number;
  quality?: string;
}

interface JobQueueState { hasQueuedJobs: boolean; hasProcessingJobs: boolean; totalPendingImages: number; }

const normalizeImages = (images: NodeImage[] | string[] | undefined): NodeImage[] => {
  if (!images || images.length === 0) return [];
  if (typeof images[0] === 'object' && 'url' in images[0]) return images as NodeImage[];
  return (images as string[]).map(url => ({ url, prompt: '', aspectRatio: '1:1', savedToGallery: false, generatedAt: new Date().toISOString() }));
};

const aspectRatios = ['1:1', '4:5', '9:16', '16:9'];
const quantities = [1, 2, 4];
const qualities = ['1K', '2K', '4K'];
const CREDITS_PER_IMAGE = 1;

export const OutputNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as OutputNodeData;
  const images = normalizeImages(nodeData.images).slice().reverse();
  const [label, setLabel] = useState(nodeData.label || 'Resultado');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow();
  const [selectedImage, setSelectedImage] = useState<NodeImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<NodeImage | null>(null);
  const [aspectRatio, setAspectRatio] = useState(nodeData.aspectRatio || '1:1');
  const [quantity, setQuantity] = useState(nodeData.quantity || 1);
  const [quality, setQuality] = useState(nodeData.quality || '1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobQueueState, setJobQueueState] = useState<JobQueueState>({ hasQueuedJobs: false, hasProcessingJobs: false, totalPendingImages: 0 });
  const { profile } = useAuth();
  const { t } = useLanguage();

  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);
  useEffect(() => { const handler = (e: CustomEvent<{ isGenerating: boolean }>) => setIsGenerating(e.detail.isGenerating); window.addEventListener(GENERATING_STATE_EVENT, handler as EventListener); return () => window.removeEventListener(GENERATING_STATE_EVENT, handler as EventListener); }, []);
  useEffect(() => { const handler = (e: CustomEvent<JobQueueState>) => setJobQueueState(e.detail); window.addEventListener(JOB_QUEUE_STATE_EVENT, handler as EventListener); return () => window.removeEventListener(JOB_QUEUE_STATE_EVENT, handler as EventListener); }, []);

  // Auto-select latest image as preview
  useEffect(() => {
    if (images.length > 0 && !selectedPreview) {
      setSelectedPreview(images[0]);
    }
  }, [images.length]);

  const previewImage = selectedPreview || images[0] || null;

  const downloadImage = async (url: string, index: number) => { const response = await fetch(url); const blob = await response.blob(); const downloadUrl = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = downloadUrl; a.download = `avion-${Date.now()}-${index}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(downloadUrl); };
  const downloadAll = async () => { for (let i = 0; i < images.length; i++) await downloadImage(images[i].url, i); };
  const handleReset = useCallback(() => { setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, images: [] } } : n)); setEdges(edges => edges.filter(e => e.source !== id && e.target !== id)); setSelectedPreview(null); }, [id, setNodes, setEdges]);
  const handleDuplicate = useCallback(() => { const currentNode = getNode(id); if (!currentNode) return; const currentEdges = getEdges(); const newId = `${currentNode.type}-${Date.now()}`; const newNode = { ...currentNode, id: newId, position: { x: currentNode.position.x + 50, y: currentNode.position.y + 50 }, selected: false, data: { ...currentNode.data } }; const connectedEdges = currentEdges.filter(e => e.source === id || e.target === id); const newEdges = connectedEdges.map((edge, i) => ({ ...edge, id: `edge-dup-${Date.now()}-${i}`, source: edge.source === id ? newId : edge.source, target: edge.target === id ? newId : edge.target })); setNodes(nds => [...nds, newNode]); setEdges(eds => [...eds, ...newEdges]); }, [id, getNode, getEdges, setNodes, setEdges]);
  const handleDelete = useCallback(() => { setNodes(nds => nds.filter(n => n.id !== id)); setEdges(eds => eds.filter(e => e.source !== id && e.target !== id)); }, [id, setNodes, setEdges]);
  const handleLabelChange = useCallback((newLabel: string) => { setLabel(newLabel); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n)); }, [id, setNodes]);
  const handleLabelKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') setIsEditing(false); else if (e.key === 'Escape') { setLabel(nodeData.label || t('editor.result')); setIsEditing(false); } };
  const handleImageClick = (image: NodeImage) => { setSelectedImage(image); setIsModalOpen(true); };
  const handleDeleteImage = useCallback(async (imageToDelete: NodeImage) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, images: normalizeImages((n.data as unknown as OutputNodeData).images).filter(img => img.url !== imageToDelete.url) } } : n));
    if (selectedPreview?.url === imageToDelete.url) setSelectedPreview(null);
    try { const { supabase } = await import('@/integrations/supabase/client'); await supabase.from('generations').delete().eq('image_url', imageToDelete.url); } catch (err) { console.error('[OutputNode] Failed to delete image from DB:', err); }
  }, [id, setNodes, selectedPreview]);

  const handleAspectChange = useCallback((value: string) => { setAspectRatio(value); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, aspectRatio: value } } : n)); }, [id, setNodes]);
  const handleQuantityChange = useCallback((value: number) => { setQuantity(value); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, quantity: value } } : n)); }, [id, setNodes]);
  const handleQualityChange = useCallback((value: string) => { setQuality(value); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, quality: value } } : n)); }, [id, setNodes]);

  const creditsNeeded = quantity * CREDITS_PER_IMAGE;
  const credits = profile?.credits || 0;
  const hasEnoughCredits = credits >= creditsNeeded;
  const isBusy = isGenerating || jobQueueState.hasQueuedJobs || jobQueueState.hasProcessingJobs;

  return <>
    <div className="flex flex-row gap-2">
      {/* Main card */}
      <div className="bg-card border border-emerald-500/30 rounded-2xl min-w-[340px] max-w-[380px] shadow-2xl shadow-emerald-500/10">
        <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-gradient-to-br !from-violet-500 !to-purple-600 !border-4 !border-card !-left-2 !shadow-lg" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              {isEditing ? (
                <Input ref={inputRef} value={label} onChange={e => handleLabelChange(e.target.value)} onBlur={() => setIsEditing(false)} onKeyDown={handleLabelKeyDown} className="h-7 w-28 text-sm font-semibold bg-muted/50 border-border/50" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} />
              ) : (
                <h3 className="font-semibold text-sm text-foreground">{label}</h3>
              )}
              <p className="text-[11px] text-muted-foreground">
                {images.length > 0 ? `${images.length} ${images.length > 1 ? t('editor.images') : t('editor.image')}` : t('editor.click_to_save')}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50"><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => downloadAll()} disabled={images.length === 0}><Download className="h-4 w-4 mr-2" />{t('editor.download_all')}</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}><Copy className="h-4 w-4 mr-2" />{t('editor.duplicate')}</DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset}><RotateCcw className="h-4 w-4 mr-2" />{t('editor.reset')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="h-4 w-4 mr-2" />{t('editor.rename')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />{t('editor.delete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main preview */}
        <div className="p-3 nowheel nodrag" onWheel={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          {previewImage ? (
            <div
              className="relative rounded-xl overflow-hidden cursor-pointer border border-border/30 hover:border-emerald-500/50 transition-all mb-3"
              onClick={() => handleImageClick(previewImage)}
            >
              <img src={previewImage.url} alt="Preview" className="w-full h-[200px] object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs text-white font-medium">{t('editor.click_to_view')}</span>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border/30 rounded-xl p-6 text-center bg-muted/10 mb-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-6 w-6 text-emerald-500/50" />
              </div>
              <p className="text-xs text-muted-foreground">{t('editor.images_will_appear')}</p>
            </div>
          )}

          {/* Quantity + Quality row */}
          <div className="flex gap-4 mb-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('editor.quantity_label')}</label>
              <div className="flex gap-1">
                {quantities.map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuantityChange(q)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                      quantity === q
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('editor.quality') || 'Qualidade'}</label>
              <div className="flex gap-1">
                {qualities.map(q => (
                  <button
                    key={q}
                    onClick={() => handleQualityChange(q)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                      quality === q
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aspect ratio row */}
          <div className="mb-3">
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('editor.aspect_ratio')}</label>
            <div className="flex gap-1">
              {aspectRatios.map(ar => (
                <button
                  key={ar}
                  onClick={() => handleAspectChange(ar)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                    aspectRatio === ar
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => window.dispatchEvent(new CustomEvent(GENERATE_IMAGE_EVENT))}
            disabled={!hasEnoughCredits || isBusy}
          >
            {jobQueueState.hasProcessingJobs ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t('editor.generating')} {jobQueueState.totalPendingImages}...</>
            ) : jobQueueState.hasQueuedJobs ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t('editor.in_queue')}...</>
            ) : isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t('editor.sending')}</>
            ) : (
              <><Sparkles className="h-4 w-4" />{t('editor.generate')} {quantity} {quantity === 1 ? t('editor.image') : t('editor.images')}<ArrowRight className="h-4 w-4" /></>
            )}
          </button>

          {/* Credits info */}
          <p className={cn("text-center text-[11px] mt-2", hasEnoughCredits ? "text-muted-foreground" : "text-destructive")}>
            {creditsNeeded} {creditsNeeded === 1 ? t('editor.credit') : t('editor.credits')} {t('editor.per_generation')} • {credits} {t('editor.available')}
          </p>
        </div>

        <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-gradient-to-br !from-emerald-500 !to-teal-600 !border-4 !border-card !-right-2 !shadow-lg" />
      </div>

      {/* Thumbnail strip */}
      {images.length > 0 && (
        <div className="flex flex-col gap-1.5 nowheel nodrag" onWheel={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <ScrollArea className="max-h-[360px]">
            <div className="flex flex-col gap-1.5 pr-1">
              {images.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  onClick={() => setSelectedPreview(image)}
                  className={cn(
                    'w-[60px] h-[60px] rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                    previewImage?.url === image.url
                      ? 'border-emerald-500 shadow-lg shadow-emerald-500/30'
                      : 'border-border/30 hover:border-emerald-500/50 opacity-70 hover:opacity-100'
                  )}
                >
                  <img src={image.url} alt={`Thumb ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>

    <OutputImageModal image={selectedImage} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onDelete={handleDeleteImage} />
  </>;
});
OutputNode.displayName = 'OutputNode';
