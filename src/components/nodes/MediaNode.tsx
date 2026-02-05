import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Image, Upload, X } from 'lucide-react';

interface MediaNodeData {
  label: string;
  url: string | null;
}

export const MediaNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as MediaNodeData;
  const [url, setUrl] = useState(nodeData.url || null);

  const handleUrlChange = (newUrl: string | null) => {
    setUrl(newUrl);
    (data as Record<string, unknown>).url = newUrl;
  };

  return (
    <div className="glass-card node-media min-w-[200px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Image className="h-4 w-4 text-node-media" />
        <span className="font-medium text-sm">Mídia</span>
      </div>
      
      {url ? (
        <div className="relative group">
          <img 
            src={url} 
            alt="Reference" 
            className="w-full h-32 object-cover rounded-lg"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleUrlChange(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            Arraste ou clique para upload
          </p>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-node-media !border-2 !border-background"
      />
    </div>
  );
});

MediaNode.displayName = 'MediaNode';
