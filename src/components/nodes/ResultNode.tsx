import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Download, Pencil, RotateCcw, MoreVertical, Copy, Trash2, Loader2, Plus, Minus, ChevronDown, Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { OutputImageModal, NodeImage } from './OutputImageModal';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Events
export const GENERATE_FOR_RESULT_EVENT = 'editor:generate-for-result';
export const RESULT_GENERATING_STATE_EVENT = 'editor:result-generating-state';
export const RESULT_JOB_QUEUE_STATE_EVENT = 'editor:result-job-queue-state';

export interface ResultNodeData {
  label: string;
  aspectRatio: string;
  quantity: number;
  images: NodeImage[] | string[];
}

interface JobQueueState {
  resultId: string;
  hasQueuedJobs: boolean;
  hasProcessingJobs: boolean;
  totalPendingImages: number;
}

// Aspect ratio icon component
const AspectIcon = ({ ratio, className = '' }: { ratio: string; className?: string }) => {
  const presets: Record<string, { w: number; h: number }> = {
    '1:1': { w: 10, h: 10 },
    '4:5': { w: 9, h: 11 },
    '16:9': { w: 14, h: 8 },
    '9:16': { w: 7, h: 12 },
    'auto': { w: 10, h: 10 },
  };
  let s = presets[ratio];
  if (!s) {
    const parts = ratio.split(':').map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      const r = parts[0] / parts[1];
      const maxDim = 13;
      const minDim = 6;
      if (r >= 1) {
        s = { w: maxDim, h: Math.max(minDim, Math.round(maxDim / r)) };
      } else {
        s = { w: Math.max(minDim, Math.round(maxDim * r)), h: maxDim };
      }
    } else {
      s = presets['1:1'];
    }
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className={className}>
      <rect
        x={(16 - s.w) / 2}
        y={(16 - s.h) / 2}
        width={s.w}
        height={s.h}
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
};

const formatOptions = [
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: 'auto', label: 'Auto' },
  { value: 'custom', label: 'Personalizado' },
];

const MAX_QUANTITY = 5;
const CREDITS_PER_IMAGE = 1;

// Helper to normalize images to new format
const normalizeImages = (images: NodeImage[] | string[] | undefined): NodeImage[] => {
  if (!images || images.length === 0) return [];
  if (typeof images[0] === 'object' && 'url' in images[0]) {
    return images as NodeImage[];
  }
  return (images as string[]).map(url => ({
    url,
    prompt: '',
    aspectRatio: '1:1',
    savedToGallery: false,
    generatedAt: new Date().toISOString()
  }));
};

export const ResultNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as ResultNodeData;
  const images = normalizeImages(nodeData.images).slice().reverse();
  
  const [aspectRatio, setAspectRatio] = useState(nodeData.aspectRatio || '1:1');
  const [quantity, setQuantity] = useState(nodeData.quantity || 1);
  const [label, setLabel] = useState(nodeData.label || 'Resultados');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [formatOpen, setFormatOpen] = useState(false);
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [jobQueueState, setJobQueueState] = useState<Omit<JobQueueState, 'resultId'>>({
    hasQueuedJobs: false,
    hasProcessingJobs: false,
    totalPendingImages: 0
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { profile, isAdmin } = useAuth();
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reset selectedIndex when images change
  useEffect(() => {
    if (images.length > 0 && selectedIndex >= images.length) {
      setSelectedIndex(0);
    }
  }, [images.length, selectedIndex]);

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Listen for generating state
  useEffect(() => {
    const handler = (e: CustomEvent<{ resultId: string; isGenerating: boolean }>) => {
      if (e.detail.resultId === id) setIsGenerating(e.detail.isGenerating);
    };
    window.addEventListener(RESULT_GENERATING_STATE_EVENT, handler as EventListener);
    return () => window.removeEventListener(RESULT_GENERATING_STATE_EVENT, handler as EventListener);
  }, [id]);

  // Listen for job queue state
  useEffect(() => {
    const handler = (e: CustomEvent<JobQueueState>) => {
      if (e.detail.resultId === id) {
        setJobQueueState({
          hasQueuedJobs: e.detail.hasQueuedJobs,
          hasProcessingJobs: e.detail.hasProcessingJobs,
          totalPendingImages: e.detail.totalPendingImages
        });
      }
    };
    window.addEventListener(RESULT_JOB_QUEUE_STATE_EVENT, handler as EventListener);
    return () => window.removeEventListener(RESULT_JOB_QUEUE_STATE_EVENT, handler as EventListener);
  }, [id]);

  const updateNodeData = useCallback((patch: Partial<ResultNodeData>) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...patch } } : node
      )
    );
  }, [id, setNodes]);

  const handleAspectChange = useCallback((value: string) => {
    if (value === 'custom') {
      setShowCustomInput(true);
      return;
    }
    setShowCustomInput(false);
    setAspectRatio(value);
    updateNodeData({ aspectRatio: value });
    setFormatOpen(false);
  }, [updateNodeData]);

  const handleCustomConfirm = useCallback(() => {
    const w = parseInt(customW, 10);
    const h = parseInt(customH, 10);
    if (w > 0 && h > 0) {
      const value = `${w}:${h}`;
      setAspectRatio(value);
      updateNodeData({ aspectRatio: value });
      setShowCustomInput(false);
      setFormatOpen(false);
    }
  }, [customW, customH, updateNodeData]);

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity(prev => {
      const next = Math.max(1, Math.min(MAX_QUANTITY, prev + delta));
      updateNodeData({ quantity: next });
      return next;
    });
  }, [updateNodeData]);

  const handleReset = useCallback(() => {
    setAspectRatio('1:1');
    setQuantity(1);
    setSelectedIndex(0);
    setNodes(nodes => nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, aspectRatio: '1:1', quantity: 1, images: [] } } : n
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
      data: { ...currentNode.data, images: [] }
    };
    const connectedEdges = currentEdges.filter(e => e.target === id);
    const newEdges = connectedEdges.map((edge, i) => ({
      ...edge,
      id: `edge-dup-${Date.now()}-${i}`,
      target: newId,
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
    updateNodeData({ label: newLabel });
  }, [updateNodeData]);

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setIsEditing(false);
    else if (e.key === 'Escape') {
      setLabel(nodeData.label || 'Resultados');
      setIsEditing(false);
    }
  };

  const handleImageClick = (index: number) => {
    setSelectedIndex(index);
  };

  const handleImageDoubleClick = () => {
    setIsModalOpen(true);
  };

  const handleDeleteImage = useCallback(async (imageToDelete: NodeImage) => {
    setNodes(nds => nds.map(n => n.id === id ? {
      ...n,
      data: {
        ...n.data,
        images: normalizeImages((n.data as unknown as ResultNodeData).images).filter(img => img.url !== imageToDelete.url)
      }
    } : n));
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.from('generations').delete().eq('image_url', imageToDelete.url);
    } catch (err) {
      console.error('[ResultNode] Failed to delete image from DB:', err);
    }
  }, [id, setNodes]);

  const downloadImage = async (url: string, index: number) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `gravyx-${Date.now()}-${index}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleGenerate = () => {
    window.dispatchEvent(new CustomEvent(GENERATE_FOR_RESULT_EVENT, { 
      detail: { resultId: id } 
    }));
  };

  const creditsNeeded = quantity * CREDITS_PER_IMAGE;
  const credits = profile?.credits || 0;
  const hasEnoughCredits = credits >= creditsNeeded;
  const hasActiveSubscription = isAdmin || profile?.subscription_status === 'active';
  const isBusy = isGenerating || jobQueueState.hasQueuedJobs || jobQueueState.hasProcessingJobs;
  const isDisabled = !hasActiveSubscription || !hasEnoughCredits || isBusy;

  const selectedImage = images.length > 0 ? images[selectedIndex] || images[0] : null;
  const isCustomRatio = !formatOptions.some(f => f.value === aspectRatio);
  const currentFormatLabel = isCustomRatio ? aspectRatio : (formatOptions.find(f => f.value === aspectRatio)?.label || aspectRatio);

  return (
    <>
      <div className="bg-[#0a0a0a] border border-emerald-500/20 rounded-2xl w-[380px] shadow-2xl shadow-emerald-500/5 overflow-hidden">
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-4 !h-4 !bg-gradient-to-br !from-emerald-500 !to-teal-600 !border-4 !border-[#0a0a0a] !-left-2 !shadow-lg" 
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-emerald-400" />
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
                <h3 className="font-semibold text-white text-base">{label}</h3>
              )}
              <p className="text-xs text-emerald-400/70">
                {images.length > 0 ? `${images.length} Imagen${images.length > 1 ? 's' : ''}` : 'Nenhuma imagem'}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/5">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" /> Resetar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Renomear
              </DropdownMenuItem>
              {selectedImage && (
                <DropdownMenuItem onClick={() => downloadImage(selectedImage.url, selectedIndex)}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Separator */}
        <div className="h-px bg-emerald-500/20 mx-2" />

        {/* Preview Area */}
        <div className="p-3">
          <div 
            className="relative rounded-xl overflow-hidden bg-zinc-900/80 border border-zinc-800/50 cursor-pointer"
            onDoubleClick={handleImageDoubleClick}
            onPointerDown={e => e.stopPropagation()}
          >
            {selectedImage ? (
              <img 
                src={selectedImage.url} 
                alt="Preview" 
                className="w-full h-auto object-contain"
                draggable={false}
              />
            ) : (
              <div className="aspect-square flex flex-col items-center justify-center gap-2">
                <Sparkles className="h-8 w-8 text-emerald-500/20" />
                <p className="text-xs text-zinc-600">Sua imagem aparecerá aqui</p>
              </div>
            )}

            {/* Loading overlay */}
            {isBusy && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                <p className="text-xs text-emerald-400 font-medium">
                  {jobQueueState.hasProcessingJobs 
                    ? `Gerando ${jobQueueState.totalPendingImages}...` 
                    : jobQueueState.hasQueuedJobs 
                      ? `Na fila (${jobQueueState.totalPendingImages})...` 
                      : 'Enviando...'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div 
            className="px-3 pb-2 nowheel nodrag overflow-x-auto" 
            onWheel={e => e.stopPropagation()} 
            onPointerDown={e => e.stopPropagation()}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-1.5 pb-1 w-max">
              {images.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  onClick={() => handleImageClick(index)}
                  className={cn(
                    'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                    selectedIndex === index
                      ? 'border-emerald-500 shadow-lg shadow-emerald-500/30'
                      : 'border-zinc-700/50 hover:border-zinc-600 opacity-70 hover:opacity-100'
                  )}
                >
                  <img 
                    src={image.url} 
                    alt={`Thumb ${index + 1}`} 
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div className="px-3 pb-3 pt-1">
          <div className="flex items-center gap-2">
            {/* Quantity Stepper */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg h-9 px-1">
              <span className="text-[10px] text-zinc-400 px-1.5 whitespace-nowrap">Qtd</span>
              <button
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-5 text-center text-sm font-semibold text-white">{quantity}</span>
              <button
                onClick={() => handleQuantityChange(1)}
                disabled={quantity >= MAX_QUANTITY}
                className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Format Dropdown */}
            <Popover open={formatOpen} onOpenChange={setFormatOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg h-9 px-2.5 text-sm text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors">
                   <AspectIcon ratio={aspectRatio} className="text-zinc-400" />
                   <span className="font-medium text-white text-xs">{currentFormatLabel}</span>
                   <ChevronDown className="h-3 w-3 text-zinc-500" />
                 </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-40 p-1 bg-zinc-900 border-zinc-700" 
                align="start"
                onPointerDown={e => e.stopPropagation()}
              >
                {formatOptions.map(opt => (
                  opt.value === 'custom' ? (
                    <button
                      key="custom"
                      onClick={() => handleAspectChange('custom')}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
                        (showCustomInput || isCustomRatio)
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  ) : (
                    <button
                      key={opt.value}
                      onClick={() => handleAspectChange(opt.value)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
                        aspectRatio === opt.value
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      )}
                    >
                      <AspectIcon ratio={opt.value} />
                      {opt.label}
                    </button>
                  )
                ))}
                {showCustomInput && (
                  <div className="flex items-center gap-1 px-2 py-2 border-t border-zinc-800 mt-1">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={customW}
                      onChange={e => setCustomW(e.target.value)}
                      placeholder="W"
                      className="w-10 h-7 rounded bg-zinc-800 border border-zinc-700 text-white text-xs text-center focus:outline-none focus:border-emerald-500"
                      onMouseDown={e => e.stopPropagation()}
                      onPointerDown={e => e.stopPropagation()}
                    />
                    <span className="text-zinc-500 text-xs">:</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={customH}
                      onChange={e => setCustomH(e.target.value)}
                      placeholder="H"
                      className="w-10 h-7 rounded bg-zinc-800 border border-zinc-700 text-white text-xs text-center focus:outline-none focus:border-emerald-500"
                      onMouseDown={e => e.stopPropagation()}
                      onPointerDown={e => e.stopPropagation()}
                      onKeyDown={e => { if (e.key === 'Enter') handleCustomConfirm(); }}
                    />
                    <button
                      onClick={handleCustomConfirm}
                      disabled={!customW || !customH || parseInt(customW) <= 0 || parseInt(customH) <= 0}
                      className="w-7 h-7 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Generate Button */}
            <Button
              className="flex-1 h-9 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed gap-1"
              onClick={handleGenerate}
              disabled={isDisabled}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Gerar</span>
                  <Play className="h-3 w-3 fill-current" />
                </>
              )}
            </Button>
          </div>

          {/* Credits info */}
          <p className={cn(
            "text-center text-[10px] mt-1.5",
            !hasActiveSubscription ? "text-destructive" : hasEnoughCredits ? "text-zinc-600" : "text-destructive"
          )}>
            {!hasActiveSubscription 
              ? 'Assine um plano para gerar' 
              : `${creditsNeeded} crédito${creditsNeeded > 1 ? 's' : ''} • ${credits} disponíveis`}
          </p>
        </div>
      </div>

      <OutputImageModal
        image={selectedImage}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDelete={handleDeleteImage}
      />
    </>
  );
});

ResultNode.displayName = 'ResultNode';
