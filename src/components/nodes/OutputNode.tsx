import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Download, Loader2, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OutputImageModal, NodeImage } from './OutputImageModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

interface OutputNodeData {
  label: string;
  images: NodeImage[] | string[]; // Support both old and new format
  isLoading: boolean;
}

// Helper to normalize images to new format
const normalizeImages = (images: NodeImage[] | string[] | undefined): NodeImage[] => {
  if (!images || images.length === 0) return [];
  
  // Check if it's already the new format
  if (typeof images[0] === 'object' && 'url' in images[0]) {
    return images as NodeImage[];
  }
  
  // Convert old format (string[]) to new format
  return (images as string[]).map((url) => ({
    url,
    prompt: '',
    aspectRatio: '1:1',
    savedToGallery: false,
    generatedAt: new Date().toISOString(),
  }));
};

export const OutputNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as OutputNodeData;
  const images = normalizeImages(nodeData.images);
  const isLoading = nodeData.isLoading || false;
  const { deleteElements, setNodes, getNodes } = useReactFlow();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

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
    deleteElements({ nodes: [{ id }] });
  };

  const handleDuplicate = () => {
    const nodes = getNodes();
    const currentNode = nodes.find((n) => n.id === id);
    if (currentNode) {
      const newNode = {
        ...currentNode,
        id: `output-${Date.now()}`,
        position: {
          x: currentNode.position.x + 50,
          y: currentNode.position.y + 50,
        },
        data: { ...currentNode.data, images: [], isLoading: false },
      };
      setNodes([...nodes, newNode]);
    }
  };

  const handleImageClick = (image: NodeImage) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const handleSaveToGallery = useCallback(async (image: NodeImage) => {
    if (!user || !projectId) throw new Error('Usuário não autenticado');

    // Insert into generations table
    const { error } = await supabase.from('generations').insert({
      user_id: user.id,
      project_id: projectId,
      prompt: image.prompt,
      aspect_ratio: image.aspectRatio,
      image_url: image.url,
      status: 'completed',
      saved_to_gallery: true,
    });

    if (error) throw error;

    // Update local node state to mark as saved
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                images: normalizeImages((n.data as unknown as OutputNodeData).images).map((img) =>
                  img.url === image.url ? { ...img, savedToGallery: true } : img
                ),
              },
            }
          : n
      )
    );

    // Update selected image state
    setSelectedImage((prev) => prev ? { ...prev, savedToGallery: true } : null);
  }, [user, projectId, id, setNodes]);

  const handleDeleteImage = useCallback((imageToDelete: NodeImage) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                images: normalizeImages((n.data as unknown as OutputNodeData).images).filter(
                  (img) => img.url !== imageToDelete.url
                ),
              },
            }
          : n
      )
    );
  }, [id, setNodes]);

  return (
    <>
      <div className="bg-card border border-emerald-500/30 rounded-2xl min-w-[320px] shadow-2xl shadow-emerald-500/10">
        <Handle
          type="target"
          position={Position.Left}
          className="!w-4 !h-4 !bg-gradient-to-br !from-violet-500 !to-purple-600 !border-4 !border-card !-left-2 !shadow-lg"
        />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Resultado</h3>
              <p className="text-xs text-muted-foreground">
                {images.length > 0 ? `${images.length} imagen${images.length > 1 ? 's' : ''}` : 'Salva automaticamente'}
              </p>
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
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 animate-spin" style={{ animationDuration: '2s' }}>
                  <div className="absolute inset-1 rounded-full bg-card" />
                </div>
                <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-violet-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-4">Gerando imagem...</p>
            </div>
          ) : images.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {images.map((image, index) => (
                  <div
                    key={`${image.url}-${index}`}
                    className="relative group rounded-xl overflow-hidden cursor-pointer border border-border/30 hover:border-emerald-500/50 transition-all"
                    onClick={() => handleImageClick(image)}
                  >
                    <img
                      src={image.url}
                      alt={`Generated ${index + 1}`}
                      className="w-full h-24 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs text-white font-medium">Clique para ver</span>
                    </div>
                    {image.savedToGallery && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-white">✓</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {images.length > 1 && (
                <Button variant="outline" className="w-full rounded-xl border-border/50" onClick={downloadAll}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Todas ({images.length})
                </Button>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-border/30 rounded-xl p-8 text-center bg-muted/10">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-emerald-500/50" />
              </div>
              <p className="text-sm text-muted-foreground">As imagens aparecerão aqui</p>
            </div>
          )}
        </div>
      </div>

      <OutputImageModal
        image={selectedImage}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaveToGallery={handleSaveToGallery}
        onDelete={handleDeleteImage}
      />
    </>
  );
});

OutputNode.displayName = 'OutputNode';
