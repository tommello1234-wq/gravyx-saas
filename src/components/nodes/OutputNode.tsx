import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Sparkles, Download, Loader2, Pencil, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OutputNodeData {
  label: string;
  images: string[];
  isLoading: boolean;
}

export const OutputNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as OutputNodeData;
  const images = nodeData.images || [];
  const isLoading = nodeData.isLoading || false;
  const { deleteElements, setNodes, getNodes } = useReactFlow();

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
      await downloadImage(images[i], i);
    }
  };

  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
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
          y: currentNode.position.y + 50,
        },
        data: { ...currentNode.data, images: [], isLoading: false },
      };
      setNodes([...nodes, newNode]);
    }
  };

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-2xl min-w-[320px] shadow-xl">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-violet-500 !border-4 !border-background !-left-2"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Resultado</h3>
            <p className="text-xs text-muted-foreground">Salva automaticamente</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500 mb-3" />
            <p className="text-sm text-muted-foreground">Gerando imagens...</p>
          </div>
        ) : images.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {images.map((url, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={url} 
                    alt={`Generated ${index + 1}`} 
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                    onClick={() => downloadImage(url, index)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full rounded-xl border-border/50"
              onClick={downloadAll}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Todas
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              As imagens aparecerão aqui
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

OutputNode.displayName = 'OutputNode';
