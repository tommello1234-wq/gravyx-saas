import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, 
  Library as LibraryIcon,
  Lock,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageViewerModal } from '@/components/ImageViewerModal';
import { useAuth } from '@/contexts/AuthContext';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';
import { SubmitToLibraryModal } from '@/components/SubmitToLibraryModal';

interface ReferenceImageWithTags {
  id: string;
  title: string;
  prompt: string;
  category: string;
  image_url: string;
  tags: string[];
  submitted_by: string | null;
  contributor?: { name: string | null; avatar_url: string | null } | null;
}

interface ReferenceCategory {
  id: string;
  slug: string;
  label: string;
}

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImage, setSelectedImage] = useState<ReferenceImageWithTags | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const { profile } = useAuth();
  
  const tier = (profile?.tier || 'free') as string;
  const isFree = tier === 'free';

  // Fetch categories from database
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
  });

  // Fetch all images with their tags via join
  const { data: references, isLoading } = useQuery({
    queryKey: ['library-images-with-tags'],
    queryFn: async () => {
      // Fetch images
      const { data: images, error: imgError } = await supabase
        .from('reference_images')
        .select('*')
        .order('created_at', { ascending: false });
      if (imgError) throw imgError;

      // Fetch all tags
      const { data: tags, error: tagError } = await supabase
        .from('reference_image_tags')
        .select('image_id, category_id');
      if (tagError) throw tagError;

      // Fetch categories for slug mapping
      const { data: cats, error: catError } = await supabase
        .from('reference_categories')
        .select('id, slug');
      if (catError) throw catError;

      const catMap = new Map(cats.map(c => [c.id, c.slug]));

      // Build tag arrays per image
      const tagsByImage = new Map<string, string[]>();
      for (const t of tags) {
        const slug = catMap.get(t.category_id);
        if (!slug) continue;
        const arr = tagsByImage.get(t.image_id) || [];
        arr.push(slug);
        tagsByImage.set(t.image_id, arr);
      }

      // Fetch contributor profiles
      const submitterIds = [...new Set(images.filter(img => img.submitted_by).map(img => img.submitted_by))];
      let profileMap = new Map<string, { name: string | null; avatar_url: string | null }>();
      if (submitterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', submitterIds);
        profileMap = new Map(
          (profiles || []).map(p => [p.user_id, { name: p.display_name, avatar_url: p.avatar_url }])
        );
      }

      return images.map(img => ({
        ...img,
        tags: tagsByImage.get(img.id) || [],
        contributor: img.submitted_by ? profileMap.get(img.submitted_by) || null : null,
      })) as ReferenceImageWithTags[];
    },
  });

  // Filter by selected category
  const filteredImages = references?.filter(img => {
    if (selectedCategory === 'all') return true;
    return img.tags.includes(selectedCategory);
  }) || [];

  // Build filter options: "Todas" first, then "Grátis", then the rest
  const freeCategory = categories.find(c => c.slug === 'free');
  const otherCategories = categories.filter(c => c.slug !== 'free');
  const filterOptions = [
    { value: 'all', label: 'Todas' },
    ...(freeCategory ? [{ value: freeCategory.slug, label: freeCategory.label }] : []),
    ...otherCategories.map(cat => ({ value: cat.slug, label: cat.label }))
  ];

  const getCategoryLabel = (slug: string) => {
    return categories.find(c => c.slug === slug)?.label || slug;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Biblioteca</h1>
            <p className="text-muted-foreground">
              Explore imagens de referência e copie os prompts
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 gap-2 border-primary/30 hover:border-primary/60"
            onClick={() => isFree ? setShowUpgrade(true) : setShowSubmitModal(true)}
          >
            <Gift className="h-4 w-4 text-primary" />
            Contribuir e ganhar créditos
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filterOptions.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? 'default' : 'outline'}
              size="sm"
              className={`rounded-full ${
                cat.value === 'all' && selectedCategory === cat.value
                  ? 'bg-gradient-to-r from-[hsl(var(--gradient-start))] via-[hsl(var(--gradient-mid))] to-[hsl(var(--gradient-end))] border-0 text-foreground'
                  : cat.value === 'all'
                  ? 'border-primary/50'
                  : ''
              }`}
              onClick={() => setSelectedCategory(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredImages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-12 text-center"
          >
            <LibraryIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma referência</h3>
            <p className="text-muted-foreground">
              {selectedCategory === 'all' 
                ? 'Ainda não há imagens de referência disponíveis'
                : 'Nenhuma imagem nesta categoria'}
            </p>
          </motion.div>
        ) : (
          <>
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
              {filteredImages.map((ref, index) => {
                const isLocked = isFree && !ref.tags.includes('free');

                return (
                  <motion.div
                    key={ref.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 12) * 0.03 }}
                    className="break-inside-avoid"
                  >
                    <div
                      className={`group relative rounded-xl overflow-hidden border border-border/50 transition-all bg-card ${
                        isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'
                      }`}
                      onClick={() => isLocked ? setShowUpgrade(true) : setSelectedImage(ref)}
                    >
                      <img
                        src={ref.image_url}
                        alt={ref.title}
                        className={`w-full object-cover transition-all ${isLocked ? 'blur-md scale-105' : ''}`}
                        loading="lazy"
                      />
                      {isLocked ? (
                        <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center gap-2">
                          <Lock className="h-6 w-6 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground font-medium">Plano pago</p>
                        </div>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform">
                            <p className="text-white font-medium truncate">{ref.title}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {ref.tags.filter(t => t !== 'free').map(tag => (
                                <span key={tag} className="text-white/70 text-sm capitalize">
                                  {getCategoryLabel(tag)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {isFree && filteredImages.some(img => !img.tags.includes('free')) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 rounded-xl border border-primary/30 bg-primary/5 text-center"
              >
                <Lock className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">
                  Imagens bloqueadas
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Faça upgrade para ter acesso completo à biblioteca
                </p>
                <Button onClick={() => setShowUpgrade(true)}>
                  Ver planos
                </Button>
              </motion.div>
            )}
          </>
        )}
      </main>

      <ImageViewerModal
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
        image={selectedImage ? {
          url: selectedImage.image_url,
          title: selectedImage.title,
          prompt: selectedImage.prompt,
          category: selectedImage.tags.filter(t => t !== 'free').map(getCategoryLabel).join(', '),
          submittedBy: selectedImage.contributor,
        } : null}
      />

      <BuyCreditsModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      <SubmitToLibraryModal open={showSubmitModal} onOpenChange={setShowSubmitModal} />
    </div>
  );
}
