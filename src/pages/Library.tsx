import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, 
  Copy,
  Library as LibraryIcon,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ReferenceImage {
  id: string;
  title: string;
  prompt: string;
  category: string;
  image_url: string;
}

const categories = [
  { value: 'all', label: 'Todas' },
  { value: 'photography', label: 'Fotografia' },
  { value: 'creative', label: 'Criativo' },
  { value: 'food', label: 'Comida' },
  { value: 'product', label: 'Produto' },
  { value: 'portrait', label: 'Retrato' },
  { value: 'landscape', label: 'Paisagem' },
  { value: 'abstract', label: 'Abstrato' },
];

export default function Library() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: references, isLoading } = useQuery({
    queryKey: ['references', selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('reference_images')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory as 'photography' | 'creative' | 'food' | 'product' | 'portrait' | 'landscape' | 'abstract');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ReferenceImage[];
    },
  });

  const copyPrompt = (ref: ReferenceImage) => {
    navigator.clipboard.writeText(ref.prompt);
    setCopiedId(ref.id);
    toast({ title: 'Prompt copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Biblioteca</h1>
          <p className="text-muted-foreground">
            Explore imagens de referência e copie os prompts
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {references?.map((ref, index) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card overflow-hidden group"
              >
                <div className="relative aspect-video">
                  <img
                    src={ref.image_url}
                    alt={ref.title}
                    className="w-full h-full object-cover"
                  />
                  <Badge 
                    variant="secondary" 
                    className="absolute top-3 left-3 capitalize"
                  >
                    {categories.find(c => c.value === ref.category)?.label || ref.category}
                  </Badge>
                </div>
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold">{ref.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ref.prompt}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-full"
                    onClick={() => copyPrompt(ref)}
                  >
                    {copiedId === ref.id ? (
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
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
