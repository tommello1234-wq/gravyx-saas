import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Sparkles, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OutputNodeData {
  label: string;
  images: string[];
  isLoading: boolean;
}

export const OutputNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as OutputNodeData;
  const images = nodeData.images || [];
  const isLoading = nodeData.isLoading || false;

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

  return (
    <div className="glass-card node-output min-w-[280px] p-4">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-node-output !border-2 !border-background"
      />
      
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-node-output" />
        <span className="font-medium text-sm">Resultado</span>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-node-output mb-2" />
          <p className="text-xs text-muted-foreground">Gerando imagens...</p>
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <img 
                src={url} 
                alt={`Generated ${index + 1}`} 
                className="w-full aspect-square object-cover rounded-lg"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => downloadImage(url, index)}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            As imagens aparecerão aqui
          </p>
        </div>
      )}
    </div>
  );
});

OutputNode.displayName = 'OutputNode';
