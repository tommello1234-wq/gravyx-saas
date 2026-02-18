import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  CheckSquare,
  Square,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ptBR, enUS, es as esLocale } from 'date-fns/locale';
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
import { Checkbox } from '@/components/ui/checkbox';

interface Generation {
  id: string;
  prompt: string;
  image_url: string;
  aspect_ratio: string;
  status: string;
  created_at: string;
}

const dateLocales = { pt: ptBR, en: enUS, es: esLocale };

export default function Gallery() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<Generation | null>(null);
  const [imageToDelete, setImageToDelete] = useState<Generation | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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
      const { error } = await supabase.from('generations').delete().eq('id', id).eq('user_id', user?.id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['gallery', user?.id] });
      const previous = queryClient.getQueryData(['gallery', user?.id]);
      queryClient.setQueryData(['gallery', user?.id], (old: Generation[] | undefined) =>
        old?.filter(g => g.id !== id) || []
      );
      return { previous };
    },
    onSuccess: () => {
      toast({ title: t('gallery.image_deleted') });
      setImageToDelete(null);
      setSelectedImage(null);
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['gallery', user?.id], context?.previous);
      toast({ 
        title: t('gallery.error_delete'),
        description: t('gallery.error_delete_desc'),
        variant: 'destructive' 
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', user?.id] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.from('generations').delete().eq('id', id).eq('user_id', user?.id);
        if (error) throw error;
      }
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['gallery', user?.id] });
      const previous = queryClient.getQueryData(['gallery', user?.id]);
      queryClient.setQueryData(['gallery', user?.id], (old: Generation[] | undefined) =>
        old?.filter(g => !ids.includes(g.id)) || []
      );
      return { previous };
    },
    onError: (_err, _ids, context) => {
      queryClient.setQueryData(['gallery', user?.id], context?.previous);
      toast({
        title: t('gallery.error_delete'),
        description: t('gallery.error_delete_some'),
        variant: 'destructive'
      });
    },
    onSuccess: () => {
      toast({ title: `${selectedIds.size} ${selectedIds.size === 1 ? t('gallery.image_label') : t('gallery.images_label')}` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', user?.id] });
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowBulkDeleteConfirm(false);
    },
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleCopy = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast({ title: t('gallery.prompt_copied') });
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
      toast({ title: t('gallery.download_started') });
    } catch {
      toast({ 
        title: t('gallery.error_download'),
        description: t('gallery.error_download_desc'),
        variant: 'destructive' 
      });
    }
  };

  const dateFormat = language === 'en' ? "MMM d, yyyy" : "d 'de' MMM 'de' yyyy";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">{t('gallery.my_gallery')}</h1>
            <p className="text-muted-foreground">
              {t('gallery.saved_images')}
            </p>
          </div>
          {generations && generations.length > 0 && (
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              onClick={selectionMode ? exitSelectionMode : () => setSelectionMode(true)}
            >
              {selectionMode ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  {t('common.cancel')}
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {t('gallery.select')}
                </>
              )}
            </Button>
          )}
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
            <h3 className="text-xl font-semibold mb-2 text-foreground">{t('gallery.no_images')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('gallery.save_from_output')}
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
                  className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all bg-card aspect-square ${
                    selectionMode && selectedIds.has(gen.id)
                      ? 'border-primary ring-2 ring-primary/50'
                      : 'border-border/50 hover:border-primary/50'
                  }`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelection(gen.id);
                    } else {
                      setSelectedImage(gen);
                    }
                  }}
                >
                  <img src={gen.image_url} alt={gen.prompt} className="w-full h-full object-cover" loading="lazy" />
                  {selectionMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedIds.has(gen.id)}
                        onCheckedChange={() => toggleSelection(gen.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 bg-background/80 border-2"
                      />
                    </div>
                  )}
                  {!selectionMode && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                        <p className="text-white text-sm line-clamp-2">{gen.prompt}</p>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-lg px-6 py-3 flex items-center gap-4"
          >
            <span className="text-sm text-foreground font-medium">
              {selectedIds.size} {selectedIds.size === 1 ? t('gallery.selected') : t('gallery.selected_plural')}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('gallery.delete_selected')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className="flex-1 bg-black/20 flex items-center justify-center p-4">
                <img src={selectedImage.image_url} alt="Generated" className="max-h-[60vh] w-auto object-contain rounded-lg" />
              </div>

              <div className="w-full md:w-80 p-6 space-y-4 border-t md:border-t-0 md:border-l border-border">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t('gallery.prompt')}</label>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border max-h-48 overflow-y-auto">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{selectedImage.prompt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(selectedImage.created_at), dateFormat, { locale: dateLocales[language] })}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
                    {selectedImage.aspect_ratio}
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleCopy(selectedImage.prompt)}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {t('gallery.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        {t('gallery.copy')}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDownload(selectedImage.image_url)}>
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
            <AlertDialogTitle className="text-foreground">{t('gallery.delete_image')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gallery.delete_image_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => imageToDelete && deleteMutation.mutate(imageToDelete.id)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {t('gallery.delete_images').replace('{count}', String(selectedIds.size)).replace('{count_label}', selectedIds.size === 1 ? t('gallery.image') : t('gallery.images'))}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('gallery.delete_images_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('gallery.delete_all')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
