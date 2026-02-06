import { memo, useState, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Upload, X, Copy, Trash2, Library, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LibraryModal } from './LibraryModal';
import type { Tables } from '@/integrations/supabase/types';

type ReferenceImage = Tables<'reference_images'>;

interface MediaNodeData {
  label: string;
  url: string | null;
  libraryPrompt?: string | null;
}

export const MediaNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as MediaNodeData;
  const [url, setUrl] = useState(nodeData.url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { deleteElements, setNodes, getNodes } = useReactFlow();

  const handleUrlChange = (newUrl: string | null, libraryPrompt?: string | null) => {
    setUrl(newUrl);
    (data as Record<string, unknown>).url = newUrl;
    (data as Record<string, unknown>).libraryPrompt = libraryPrompt || null;
  };

  const handleSelectFromLibrary = (image: ReferenceImage) => {
    handleUrlChange(image.image_url, image.prompt);
    setShowLibrary(false);
    toast({
      title: 'Imagem selecionada!',
      description: 'Use o botão de copiar para copiar o prompt.',
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('reference-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('reference-images').getPublicUrl(fileName);
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
    const currentNode = nodes.find((n) => n.id === id);
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
    <div className="bg-card border border-blue-500/30 rounded-2xl min-w-[280px] shadow-2xl shadow-blue-500/10">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-blue-500/10 to-transparent rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Image className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Mídia</h3>
            <p className="text-xs text-muted-foreground">Imagem de referência</p>
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
        {url ? (
          <div className="relative group rounded-xl overflow-hidden">
            <img src={url} alt="Reference" className="w-full h-40 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {nodeData.libraryPrompt && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    navigator.clipboard.writeText(nodeData.libraryPrompt || '');
                    toast({ title: 'Prompt copiado!' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="h-9 w-9"
                onClick={() => handleUrlChange(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'library')}>
              <TabsList className="w-full bg-muted/30">
                <TabsTrigger value="upload" className="flex-1 gap-2 data-[state=active]:bg-blue-500/20">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="library" className="flex-1 gap-2 data-[state=active]:bg-blue-500/20">
                  <Library className="h-4 w-4" />
                  Biblioteca
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === 'upload' ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 mx-auto text-blue-500 animate-spin mb-2" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 group-hover:text-blue-500 mb-2 transition-colors" />
                )}
                <p className="text-sm text-muted-foreground">
                  {isUploading ? 'Enviando...' : 'Clique para upload'}
                </p>
              </button>
            ) : (
              <button
                onClick={() => setShowLibrary(true)}
                className="w-full border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
              >
                <Library className="h-8 w-8 mx-auto text-muted-foreground/50 group-hover:text-blue-500 mb-2 transition-colors" />
                <p className="text-sm text-muted-foreground">Escolher da biblioteca</p>
              </button>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-gradient-to-br !from-blue-500 !to-cyan-600 !border-4 !border-card !-right-2 !shadow-lg"
      />

      <LibraryModal open={showLibrary} onOpenChange={setShowLibrary} onSelect={handleSelectFromLibrary} />
    </div>
  );
});

MediaNode.displayName = 'MediaNode';