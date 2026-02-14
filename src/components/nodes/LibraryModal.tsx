import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getTierConfig } from '@/lib/plan-limits';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Search, Loader2, Lock } from 'lucide-react';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';
import type { Tables } from '@/integrations/supabase/types';

type ReferenceImage = Tables<'reference_images'>;

interface ReferenceCategory {
  id: string;
  slug: string;
  label: string;
}

interface LibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (image: ReferenceImage) => void;
}

export function LibraryModal({ open, onOpenChange, onSelect }: LibraryModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const tier = (profile?.tier || 'free') as string;
  const { libraryLimit } = getTierConfig(tier);
  const isLimited = libraryLimit !== -1;

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['reference-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_categories')
        .select('*')
        .order('label', { ascending: true });
      if (error) throw error;
      return data as ReferenceCategory[];
    },
    enabled: open,
  });

  const { data: images, isLoading } = useQuery({
    queryKey: ['library-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_images')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getCategoryLabel = (slug: string) => {
    return categories.find(c => c.slug === slug)?.label || slug;
  };

  const filteredImages = images?.filter((img) => {
    if (selectedCategory && img.category !== selectedCategory) {
      return false;
    }
    if (search) {
      return (
        img.title.toLowerCase().includes(search.toLowerCase()) ||
        img.prompt.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  const handleCopyPrompt = (prompt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt);
    toast({ title: 'Prompt copiado!' });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Biblioteca de Referências</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, prompt ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedCategory === null ? "default" : "secondary"}
              className="cursor-pointer hover:bg-primary/80 transition-colors"
              onClick={() => setSelectedCategory(null)}
            >
              Todas
            </Badge>
            {categories.map((cat) => (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.slug ? "default" : "secondary"}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => setSelectedCategory(cat.slug)}
              >
                {cat.label}
              </Badge>
            ))}
          </div>

          <ScrollArea className="h-[45vh] pr-4 nowheel" onWheel={(e) => e.stopPropagation()}>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredImages?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma imagem encontrada
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredImages?.map((image, index) => {
                  const isLocked = isLimited && index >= libraryLimit;

                  return (
                    <div
                      key={image.id}
                      className={`group relative rounded-xl overflow-hidden border border-border/50 transition-colors ${
                        isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'
                      }`}
                      onClick={() => isLocked ? setShowUpgrade(true) : onSelect(image)}
                    >
                      <img
                        src={image.image_url}
                        alt={image.title}
                        className={`w-full aspect-square object-cover transition-all ${isLocked ? 'blur-md scale-105' : ''}`}
                      />
                      {isLocked ? (
                        <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center gap-1">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground font-medium">Plano pago</p>
                        </div>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {image.title}
                                </p>
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {getCategoryLabel(image.category)}
                                </Badge>
                              </div>
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={(e) => handleCopyPrompt(image.prompt, e)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <BuyCreditsModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </>
  );
}
