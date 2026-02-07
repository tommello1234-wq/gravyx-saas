import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Loader2 } from 'lucide-react';
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
  onDelete: (image: NodeImage) => void;
}

export function OutputImageModal({
  image,
  isOpen,
  onClose,
  onDelete,
}: OutputImageModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  if (!image) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    onDelete(image);
    onClose();
    toast({ title: 'Imagem removida do node' });
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

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
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
        <div className="text-xs text-muted-foreground pt-2">
          <span>Gerado em: {new Date(image.generatedAt).toLocaleString('pt-BR')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
