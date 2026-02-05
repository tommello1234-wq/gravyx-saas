import { memo, useState, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Image, Upload, X, Pencil, Copy, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface MediaNodeData {
  label: string;
  url: string | null;
}

export const MediaNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as MediaNodeData;
  const [url, setUrl] = useState(nodeData.url || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { deleteElements, setNodes, getNodes } = useReactFlow();

  const handleUrlChange = (newUrl: string | null) => {
    setUrl(newUrl);
    (data as Record<string, unknown>).url = newUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reference-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('reference-images')
        .getPublicUrl(fileName);

      handleUrlChange(urlData.publicUrl);
      toast({ title: 'Imagem enviada com sucesso!' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
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
        id: `media-${Date.now()}`,
        position: {
          x: currentNode.position.x + 50,
          y: currentNode.position.y + 50,
        },
        data: { ...currentNode.data },
      };
      setNodes([...nodes, newNode]);
    }
  };

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-2xl min-w-[280px] shadow-xl">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Image className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Mídia</h3>
            <p className="text-xs text-muted-foreground">Imagem de referência</p>
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
        {url ? (
          <div className="relative group">
            <img 
              src={url} 
              alt="Reference" 
              className="w-full h-40 object-cover rounded-xl"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleUrlChange(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-violet-500/50 hover:bg-violet-500/5 transition-colors"
          >
            <Upload className={`h-10 w-10 mx-auto text-muted-foreground/50 mb-3 ${isUploading ? 'animate-pulse' : ''}`} />
            <p className="text-sm text-muted-foreground">
              {isUploading ? 'Enviando...' : 'Clique para upload'}
            </p>
          </button>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-violet-500 !border-4 !border-background !-right-2"
      />
    </div>
  );
});

MediaNode.displayName = 'MediaNode';
