import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Loader2, 
  Sparkles,
  Trash2,
  Download,
  Copy,
  Check,
  Calendar,
  X,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Generation {
  id: string;
  prompt: string;
  image_url: string;
  aspect_ratio: string;
  status: string;
  created_at: string;
}

export default function Gallery() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<Generation | null>(null);
  const [imageToDelete, setImageToDelete] = useState<Generation | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: generations, isLoading } = useQuery({
    queryKey: ['gallery', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .eq('saved_to_gallery', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Generation[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', user?.id] });
      toast({ title: 'Imagem excluída da galeria' });
      setImageToDelete(null);
      setSelectedImage(null);
    },
    onError: () => {
      toast({ 
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a imagem.',
        variant: 'destructive' 
      });
    },
  });

  const handleCopy = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast({ title: 'Prompt copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
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
    } catch {
      toast({ 
        title: 'Erro ao baixar',
        description: 'Não foi possível baixar a imagem.',
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Minha Galeria</h1>
          <p className="text-muted-foreground">
            Imagens que você salvou dos seus projetos
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : generations?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-12 text-center"
          >
            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-foreground">Nenhuma imagem ainda</h3>
            <p className="text-muted-foreground mb-6">
              Salve imagens do Output Node para vê-las aqui
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {generations?.map((gen, index) => (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
              >
                <div
                  className="group relative rounded-xl overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-all bg-card aspect-square"
                  onClick={() => setSelectedImage(gen)}
                >
                  <img
                    src={gen.image_url}
                    alt={gen.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-sm line-clamp-2">{gen.prompt}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Image Viewer Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border-border">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-10 bg-background/80 hover:bg-background text-foreground"
            onClick={() => setSelectedImage(null)}
          >
            <X className="h-4 w-4" />
          </Button>

          {selectedImage && (
            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div className="flex-1 bg-black/20 flex items-center justify-center p-4">
                <img
                  src={selectedImage.image_url}
                  alt="Generated"
                  className="max-h-[60vh] w-auto object-contain rounded-lg"
                />
              </div>

              {/* Details */}
              <div className="w-full md:w-80 p-6 space-y-4 border-t md:border-t-0 md:border-l border-border">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Prompt</label>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border max-h-48 overflow-y-auto">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{selectedImage.prompt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(selectedImage.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
                    {selectedImage.aspect_ratio}
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCopy(selectedImage.prompt)}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleDownload(selectedImage.image_url)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setImageToDelete(selectedImage)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!imageToDelete} onOpenChange={() => setImageToDelete(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A imagem será removida permanentemente da sua galeria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => imageToDelete && deleteMutation.mutate(imageToDelete.id)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
