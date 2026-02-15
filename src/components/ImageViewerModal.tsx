import { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Copy, Check, Download, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImageViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: {
    url: string;
    title?: string;
    prompt: string;
    category?: string;
    aspectRatio?: string;
    createdAt?: string;
    submittedBy?: { name: string | null; avatar_url: string | null } | null;
  } | null;
  showDownload?: boolean;
}

export function ImageViewerModal({
  open,
  onOpenChange,
  image,
  showDownload = false,
}: ImageViewerModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!image) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(image.prompt);
    setCopied(true);
    toast({ title: 'Prompt copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border-border">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-10 bg-background/80 hover:bg-background text-foreground"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex flex-col md:flex-row">
          {/* Image */}
          <div className="flex-1 bg-black/20 flex items-center justify-center p-4">
            <img
              src={image.url}
              alt={image.title || 'Image'}
              className="max-h-[60vh] w-auto object-contain rounded-lg"
            />
          </div>

          {/* Details */}
          <div className="w-full md:w-80 p-6 space-y-4 border-t md:border-t-0 md:border-l border-border">
            {image.title && (
              <div>
                <h3 className="font-semibold text-lg text-foreground">{image.title}</h3>
                {image.category && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {image.category}
                  </span>
                )}
              </div>
            )}

            {image.submittedBy && (
              <div className="flex items-center gap-2 text-sm">
                {image.submittedBy.avatar_url ? (
                  <img src={image.submittedBy.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {(image.submittedBy.name || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-muted-foreground">
                  Contribuição de <strong className="text-foreground">{image.submittedBy.name || 'Usuário'}</strong>
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Prompt</label>
              <div className="p-3 rounded-lg bg-muted/30 border border-border max-h-48 overflow-y-auto">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{image.prompt}</p>
              </div>
            </div>

            {image.createdAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(image.createdAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                </span>
                {image.aspectRatio && (
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
                    {image.aspectRatio}
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar prompt
                  </>
                )}
              </Button>
              {showDownload && (
                <Button variant="outline" size="icon" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}