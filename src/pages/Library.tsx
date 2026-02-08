import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, 
  Library as LibraryIcon,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageViewerModal } from '@/components/ImageViewerModal';
import { AddReferenceModal } from '@/components/AddReferenceModal';

interface ReferenceImage {
  id: string;
  title: string;
  prompt: string;
  category: string;
  image_url: string;
}

interface ReferenceCategory {
  id: string;
  slug: string;
  label: string;
}

export default function Library() {
  const { isAdmin } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImage, setSelectedImage] = useState<ReferenceImage | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

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

  const { data: references, isLoading } = useQuery({
    queryKey: ['references', selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('reference_images')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ReferenceImage[];
    },
  });

  // Build filter options with "Todas" first
  const filterOptions = [
    { value: 'all', label: 'Todas' },
    ...categories.map(cat => ({ value: cat.slug, label: cat.label }))
  ];

  const getCategoryLabel = (slug: string) => {
    return categories.find(c => c.slug === slug)?.label || slug;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Biblioteca</h1>
            <p className="text-muted-foreground">
              Explore imagens de referência e copie os prompts
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setAddModalOpen(true)} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filterOptions.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
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
        ) : references?.length === 0 ? (
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
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {references?.map((ref, index) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="break-inside-avoid"
              >
                <div
                  className="group relative rounded-xl overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-all bg-card"
                  onClick={() => setSelectedImage(ref)}
                >
                  <img
                    src={ref.image_url}
                    alt={ref.title}
                    className="w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white font-medium truncate">{ref.title}</p>
                    <p className="text-white/70 text-sm capitalize">
                      {getCategoryLabel(ref.category)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <ImageViewerModal
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
        image={selectedImage ? {
          url: selectedImage.image_url,
          title: selectedImage.title,
          prompt: selectedImage.prompt,
          category: getCategoryLabel(selectedImage.category),
        } : null}
      />

      <AddReferenceModal open={addModalOpen} onOpenChange={setAddModalOpen} />
    </div>
  );
}