import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Download, Pencil, RotateCcw, MoreVertical, Copy, Trash2, Square, RectangleVertical, Smartphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  images: NodeImage[] | string[];
}

interface JobQueueState {
  resultId: string;
  hasQueuedJobs: boolean;
  hasProcessingJobs: boolean;
  totalPendingImages: number;
}

const aspectRatios = [
  { value: '1:1', label: '1:1', icon: Square },
  { value: '4:5', label: '4:5', icon: RectangleVertical },
  { value: '9:16', label: '9:16', icon: Smartphone },
  { value: '16:9', label: '16:9', icon: RectangleVertical },
];

const quantities = [1, 2, 4];

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
  
  // Local state for configs
  const [aspectRatio, setAspectRatio] = useState(nodeData.aspectRatio || '1:1');
  const [quantity, setQuantity] = useState(nodeData.quantity || 1);
  const [label, setLabel] = useState(nodeData.label || 'Resultado');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobQueueState, setJobQueueState] = useState<Omit<JobQueueState, 'resultId'>>({
    hasQueuedJobs: false,
    hasProcessingJobs: false,
    totalPendingImages: 0
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();
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

  const handleReset = useCallback(() => {
    setAspectRatio('1:1');
    setQuantity(1);
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
      data: { ...currentNode.data, images: [] } // Don't copy images
    };
    
    // Recreate input edges (keep connections to prompts/media/gravity)
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
    // Optimistically remove from UI
    setNodes(nds => nds.map(n => n.id === id ? {
      ...n,
      data: {
        ...n.data,
        images: normalizeImages((n.data as unknown as ResultNodeData).images).filter(img => img.url !== imageToDelete.url)
      }
    } : n));

    // Persist deletion to database
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('generations')
        .delete()
        .eq('image_url', imageToDelete.url);
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
  const isDisabled = !hasEnoughCredits || isGenerating || jobQueueState.hasQueuedJobs || jobQueueState.hasProcessingJobs;

  return (
    <>
      <div className="bg-card border border-emerald-500/30 rounded-2xl min-w-[320px] shadow-2xl shadow-emerald-500/10">
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-4 !h-4 !bg-gradient-to-br !from-emerald-500 !to-teal-600 !border-4 !border-card !-left-2 !shadow-lg" 
        />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-5 w-5 text-white" />
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
              <p className="text-xs text-muted-foreground">
                {images.length > 0 ? `${images.length} imagen${images.length > 1 ? 's' : ''}` : 'Configure e gere'}
              </p>
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
        <div className="p-4 space-y-4">
          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Proporção</label>
            <div className="grid grid-cols-4 gap-1.5">
              {aspectRatios.map(ar => {
                const Icon = ar.icon;
                return (
                  <button
                    key={ar.value}
                    onClick={() => handleAspectChange(ar.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-xs',
                      aspectRatio === ar.value
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                        : 'bg-muted/20 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', ar.value === '16:9' && 'rotate-90')} />
                    <span className="font-medium">{ar.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
            <div className="grid grid-cols-3 gap-1.5">
              {quantities.map(q => (
                <button
                  key={q}
                  onClick={() => handleQuantityChange(q)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all',
                    quantity === q
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-muted/20 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/40'
                  )}
                >
                  <span className="text-lg font-bold">{q}</span>
                  <span className="text-xs">{q === 1 ? 'imagem' : 'imagens'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Images Grid */}
          <div className="nowheel nodrag" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            {images.length > 0 ? (
              <div className="space-y-3">
                {images.length > 6 ? (
                  <ScrollArea className="h-[160px] nowheel nodrag" onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-2 pr-2">
                      {images.map((image, index) => (
                        <div
                          key={`${image.url}-${index}`}
                          className="relative group rounded-lg overflow-hidden cursor-pointer border border-border/30 hover:border-emerald-500/50 transition-all"
                          onClick={() => handleImageClick(image)}
                        >
                          <img src={image.url} alt={`Generated ${index + 1}`} className="w-full h-20 object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs text-white font-medium">Ver</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((image, index) => (
                      <div
                        key={`${image.url}-${index}`}
                        className="relative group rounded-lg overflow-hidden cursor-pointer border border-border/30 hover:border-emerald-500/50 transition-all"
                        onClick={() => handleImageClick(image)}
                      >
                        <img src={image.url} alt={`Generated ${index + 1}`} className="w-full h-20 object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs text-white font-medium">Ver</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {images.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg border-border/50 bg-card text-foreground hover:bg-muted text-xs"
                    onClick={downloadAll}
                  >
                    <Download className="h-3 w-3 mr-1.5" />
                    Baixar Todas ({images.length})
                  </Button>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-border/30 rounded-lg p-4 text-center bg-muted/5">
                <Sparkles className="h-6 w-6 text-emerald-500/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">As imagens aparecerão aqui</p>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleGenerate}
            disabled={isDisabled}
          >
            {jobQueueState.hasProcessingJobs ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando {jobQueueState.totalPendingImages}...
              </>
            ) : jobQueueState.hasQueuedJobs ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Na fila ({jobQueueState.totalPendingImages})...
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar {quantity} {quantity === 1 ? 'Imagem' : 'Imagens'}
              </>
            )}
          </Button>

          <p className={cn(
            "text-center text-xs",
            hasEnoughCredits ? "text-muted-foreground" : "text-destructive"
          )}>
            {creditsNeeded} {creditsNeeded === 1 ? 'crédito' : 'créditos'} • {credits} disponíveis
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

