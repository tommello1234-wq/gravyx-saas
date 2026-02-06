import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, 
  Sparkles,
} from 'lucide-react';
import { ImageViewerModal } from '@/components/ImageViewerModal';

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
  const [selectedImage, setSelectedImage] = useState<Generation | null>(null);

  const { data: generations, isLoading } = useQuery({
    queryKey: ['generations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Generation[];
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Minha Galeria</h1>
          <p className="text-muted-foreground">
            Todas as imagens que você gerou
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
            <h3 className="text-xl font-semibold mb-2">Nenhuma imagem ainda</h3>
            <p className="text-muted-foreground mb-6">
              Comece a gerar imagens nos seus projetos
            </p>
          </motion.div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
            {generations?.map((gen, index) => (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className="break-inside-avoid"
              >
                <div
                  className="group relative rounded-xl overflow-hidden border border-border/50 cursor-pointer hover:border-primary/50 transition-all bg-card"
                  onClick={() => setSelectedImage(gen)}
                >
                  <img
                    src={gen.image_url}
                    alt={gen.prompt}
                    className="w-full object-cover"
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

      <ImageViewerModal
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
        image={selectedImage ? {
          url: selectedImage.image_url,
          prompt: selectedImage.prompt,
          aspectRatio: selectedImage.aspect_ratio,
          createdAt: selectedImage.created_at,
        } : null}
        showDownload
      />
    </div>
  );
}