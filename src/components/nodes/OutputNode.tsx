import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Download, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OutputImageModal, NodeImage } from './OutputImageModal';
interface OutputNodeData {
  label: string;
  images: NodeImage[] | string[]; // Support both old and new format
}

// Helper to normalize images to new format
const normalizeImages = (images: NodeImage[] | string[] | undefined): NodeImage[] => {
  if (!images || images.length === 0) return [];

  // Check if it's already the new format
  if (typeof images[0] === 'object' && 'url' in images[0]) {
    return images as NodeImage[];
  }

  // Convert old format (string[]) to new format
  return (images as string[]).map(url => ({
    url,
    prompt: '',
    aspectRatio: '1:1',
    savedToGallery: false,
    generatedAt: new Date().toISOString()
  }));
};
export const OutputNode = memo(({
  data,
  id
}: NodeProps) => {
  const nodeData = data as unknown as OutputNodeData;
  const images = normalizeImages(nodeData.images);
  const {
    deleteElements,
    setNodes,
    getNodes
  } = useReactFlow();
  const [selectedImage, setSelectedImage] = useState<NodeImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const downloadImage = async (url: string, index: number) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `avion-${Date.now()}-${index}.png`;
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
  const handleDelete = () => {
    deleteElements({
      nodes: [{
        id
      }]
    });
  };
  const handleDuplicate = () => {
    const nodes = getNodes();
    const currentNode = nodes.find(n => n.id === id);
    if (currentNode) {
      const newNode = {
        ...currentNode,
        id: `output-${Date.now()}`,
        position: {
          x: currentNode.position.x + 50,
          y: currentNode.position.y + 50
        },
        data: {
          ...currentNode.data,
          images: [],
          isLoading: false
        }
      };
      setNodes([...nodes, newNode]);
    }
  };
  const handleImageClick = (image: NodeImage) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const handleDeleteImage = useCallback((imageToDelete: NodeImage) => {
    setNodes(nds => nds.map(n => n.id === id ? {
      ...n,
      data: {
        ...n.data,
        images: normalizeImages((n.data as unknown as OutputNodeData).images).filter(img => img.url !== imageToDelete.url)
      }
    } : n));
  }, [id, setNodes]);
  return <>
      <div className="bg-card border border-emerald-500/30 rounded-2xl min-w-[320px] shadow-2xl shadow-emerald-500/10">
        <Handle type="target" position={Position.Left} className="!w-4 !h-4 !bg-gradient-to-br !from-violet-500 !to-purple-600 !border-4 !border-card !-left-2 !shadow-lg" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-primary-foreground">Resultado</h3>
              <p className="text-xs text-muted-foreground">
                {images.length > 0 ? `${images.length} imagen${images.length > 1 ? 's' : ''}` : 'Clique para salvar'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={handleDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {images.length > 0 ? <div className="space-y-4">
              {images.length > 6 ? (
                <ScrollArea className="h-[200px]">
                  <div className="grid grid-cols-2 gap-2 pr-2">
                    {images.map((image, index) => (
                      <div 
                        key={`${image.url}-${index}`} 
                        className="relative group rounded-xl overflow-hidden cursor-pointer border border-border/30 hover:border-emerald-500/50 transition-all" 
                        onClick={() => handleImageClick(image)}
                      >
                        <img src={image.url} alt={`Generated ${index + 1}`} className="w-full h-24 object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs text-white font-medium">Clique para ver</span>
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
                      className="relative group rounded-xl overflow-hidden cursor-pointer border border-border/30 hover:border-emerald-500/50 transition-all" 
                      onClick={() => handleImageClick(image)}
                    >
                      <img src={image.url} alt={`Generated ${index + 1}`} className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs text-white font-medium">Clique para ver</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {images.length > 1 && <Button variant="outline" className="w-full rounded-xl border-border/50 bg-card text-foreground hover:bg-muted" onClick={downloadAll}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Todas ({images.length})
                </Button>}
            </div> : <div className="border-2 border-dashed border-border/30 rounded-xl p-8 text-center bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-emerald-500/50" />
              </div>
              <p className="text-sm text-muted-foreground">As imagens aparecerão aqui</p>
            </div>}
        </div>
      </div>

      <OutputImageModal image={selectedImage} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onDelete={handleDeleteImage} />
    </>;
});
OutputNode.displayName = 'OutputNode';