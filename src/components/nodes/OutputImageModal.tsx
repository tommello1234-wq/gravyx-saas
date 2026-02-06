import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Bookmark, Trash2, Check, Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface NodeImage {
  url: string;
  prompt: string;
  aspectRatio: string;
  savedToGallery: boolean;
  generatedAt: string;
}

interface OutputImageModalProps {
  image: NodeImage | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveToGallery: (image: NodeImage) => Promise<void>;
  onDelete: (image: NodeImage) => void;
}

export function OutputImageModal({
  image,
  isOpen,
  onClose,
  onSaveToGallery,
  onDelete,
}: OutputImageModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  if (!image) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `avion-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: 'Download iniciado!' });
    } catch (error) {
      toast({
        title: 'Erro ao baixar',
        description: 'Não foi possível baixar a imagem.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveToGallery = async () => {
    if (image.savedToGallery) return;
    setIsSaving(true);
    try {
      await onSaveToGallery(image);
      toast({ title: 'Salvo na galeria!' });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar na galeria.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete(image);
    onClose();
    toast({ title: 'Imagem removida do node' });
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(image.prompt);
    toast({ title: 'Prompt copiado!' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Visualizar Imagem</DialogTitle>
        </DialogHeader>

        {/* Image */}
        <div className="relative rounded-xl overflow-hidden bg-muted/20">
          <img
            src={image.url}
            alt="Generated"
            className="w-full h-auto max-h-[60vh] object-contain"
          />
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Prompt</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyPrompt}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </Button>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-sm text-foreground/80">{image.prompt || 'Sem prompt'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
            onClick={handleSaveToGallery}
            disabled={image.savedToGallery || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : image.savedToGallery ? (
              <Check className="h-4 w-4 mr-2 text-emerald-500" />
            ) : (
              <Bookmark className="h-4 w-4 mr-2" />
            )}
            {image.savedToGallery ? 'Salvo na Galeria' : 'Salvar na Galeria'}
          </Button>

          <Button
            variant="outline"
            className="flex-1 rounded-xl border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar
          </Button>

          <Button
            variant="outline"
            className="flex-1 rounded-xl border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        </div>

        {/* Metadata */}
        <div className="flex gap-4 text-xs text-muted-foreground pt-2">
          <span>Proporção: {image.aspectRatio}</span>
          <span>Gerado em: {new Date(image.generatedAt).toLocaleString('pt-BR')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
