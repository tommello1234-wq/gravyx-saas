import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Download, Pencil, RotateCcw, MoreVertical, Copy, Trash2, Loader2, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

// Events
export const GENERATE_FOR_RESULT_EVENT = 'editor:generate-for-result';
export const RESULT_GENERATING_STATE_EVENT = 'editor:result-generating-state';
export const RESULT_JOB_QUEUE_STATE_EVENT = 'editor:result-job-queue-state';

export interface ResultNodeData {
  label: string;
  aspectRatio: string;
  quantity: number;
  quality?: string;
  images: NodeImage[] | string[];
}

interface JobQueueState {
  resultId: string;
  hasQueuedJobs: boolean;
  hasProcessingJobs: boolean;
  totalPendingImages: number;
}

const aspectRatios = ['1:1', '4:5', '9:16', '16:9'];
const quantities = [1, 2, 4];
const qualities = ['1K', '2K', '4K'];
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
  const [quality, setQuality] = useState(nodeData.quality || '1K');
  const [label, setLabel] = useState(nodeData.label || 'Resultado');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobQueueState, setJobQueueState] = useState<Omit<JobQueueState, 'resultId'>>({
    hasQueuedJobs: false,
    hasProcessingJobs: false,
    totalPendingImages: 0
  });
  const [selectedPreview, setSelectedPreview] = useState<NodeImage | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { profile, isAdmin } = useAuth();
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow();
  const [selectedImage, setSelectedImage] = useState<NodeImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Listen for generating state events specific to this node
  useEffect(() => {
    const handler = (e: CustomEvent<{ resultId: string; isGenerating: boolean }>) => {
      if (e.detail.resultId === id) {
        setIsGenerating(e.detail.isGenerating);
      }
    };
    window.addEventListener(RESULT_GENERATING_STATE_EVENT, handler as EventListener);
    return () => window.removeEventListener(RESULT_GENERATING_STATE_EVENT, handler as EventListener);
  }, [id]);

  // Listen for job queue state events specific to this node
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

  // Auto-select latest image as preview
  useEffect(() => {
    if (images.length > 0 && !selectedPreview) {
      setSelectedPreview(images[0]);
    }
  }, [images.length]);

  const previewImage = selectedPreview || images[0] || null;

  const handleAspectChange = useCallback((value: string) => {
    setAspectRatio(value);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, aspectRatio: value } } : node
      )
    );
  }, [id, setNodes]);

  const handleQuantityChange = useCallback((value: number) => {
    setQuantity(value);
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, quantity: value } } : node
      )
    );
  }, [id, setNodes]);

  const handleQualityChange = useCallback((value: string) => {
    setQuality(value);
    setNodes(nodes => nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, quality: value } } : n
    ));
  }, [id, setNodes]);

  const handleReset = useCallback(() => {
    setAspectRatio('1:1');
    setQuantity(1);
    setQuality('1K');
    setSelectedPreview(null);
    setNodes(nodes => nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, aspectRatio: '1:1', quantity: 1, quality: '1K', images: [] } } : n
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
    setNodes(nodes => nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
    ));
  }, [id, setNodes]);

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setLabel(nodeData.label || 'Resultado');
      setIsEditing(false);
    }
  };

  const handleImageClick = (image: NodeImage) => {
    setSelectedImage(image);
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

    if (selectedPreview?.url === imageToDelete.url) setSelectedPreview(null);

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('generations')
        .delete()
        .eq('image_url', imageToDelete.url);
    } catch (err) {
      console.error('[ResultNode] Failed to delete image from DB:', err);
    }
  }, [id, setNodes, selectedPreview]);

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

  const downloadAll = async () => {
    for (let i = 0; i < images.length; i++) {
      await downloadImage(images[i].url, i);
    }
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

  return (
    <>
      <div className="flex flex-row gap-2">
        {/* Main card */}
        <div className="bg-[#0a0a0a] border border-emerald-500/30 rounded-2xl min-w-[340px] max-w-[380px] shadow-2xl shadow-emerald-500/10">
          <Handle 
            type="target" 
            position={Position.Left} 
            className="!w-4 !h-4 !bg-gradient-to-br !from-emerald-500 !to-teal-600 !border-4 !border-card !-left-2 !shadow-lg" 
          />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    value={label}
                    onChange={e => handleLabelChange(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    onKeyDown={handleLabelKeyDown}
                    className="h-7 w-28 text-sm font-semibold bg-muted/50 border-border/50"
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                  />
                ) : (
                  <h3 className="font-semibold text-sm text-foreground">{label}</h3>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {images.length > 0 ? `${images.length} imagen${images.length > 1 ? 's' : ''}` : 'Configure e gere'}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => downloadAll()} disabled={images.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Todas
                </DropdownMenuItem>
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
          <div className="p-3 nowheel nodrag" onWheel={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            {/* Main preview */}
            {previewImage ? (
              <div 
                className="relative rounded-xl overflow-hidden cursor-pointer border border-emerald-500/20 hover:border-emerald-500/50 transition-all mb-3 bg-black"
                onClick={() => handleImageClick(previewImage)}
              >
                <img 
                  src={previewImage.url} 
                  alt="Preview" 
                  className="w-full h-auto object-contain max-h-[400px]" 
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-xs text-white font-medium">Clique para ampliar</span>
                </div>
              </div>
            ) : (
              <div className="aspect-square rounded-xl border-2 border-dashed border-emerald-500/20 bg-black/40 flex flex-col items-center justify-center mb-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                  <Sparkles className="h-7 w-7 text-emerald-500/40" />
                </div>
                <p className="text-xs text-muted-foreground">As imagens aparecerão aqui</p>
              </div>
            )}

            {/* Bottom controls - always visible */}
            <div className="flex items-center gap-1">
              {/* Quantidade popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                    Quantidade
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto p-2 bg-[#1a1a1a] border-emerald-500/20">
                  <div className="flex gap-1">
                    {quantities.map(q => (
                      <button
                        key={q}
                        onClick={() => handleQuantityChange(q)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-semibold transition-all border',
                          quantity === q
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Formato popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                    Formato
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-auto p-2 bg-[#1a1a1a] border-emerald-500/20">
                  <div className="flex gap-1">
                    {aspectRatios.map(ar => (
                      <button
                        key={ar}
                        onClick={() => handleAspectChange(ar)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-semibold transition-all border',
                          aspectRatio === ar
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                        )}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Generate button */}
              <button
                className="ml-auto px-5 py-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleGenerate}
                disabled={isDisabled}
              >
                {jobQueueState.hasProcessingJobs ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Gerando {jobQueueState.totalPendingImages}...</>
                ) : jobQueueState.hasQueuedJobs ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Na fila...</>
                ) : isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
                ) : (
                  <>Gerar {quantity} {quantity === 1 ? 'Imagem' : 'Imagens'}<Play className="h-3.5 w-3.5 fill-current" /></>
                )}
              </button>
            </div>
          </div>

          <Handle 
            type="source" 
            position={Position.Right} 
            className="!w-4 !h-4 !bg-gradient-to-br !from-emerald-500 !to-teal-600 !border-4 !border-card !-right-2 !shadow-lg" 
          />
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
