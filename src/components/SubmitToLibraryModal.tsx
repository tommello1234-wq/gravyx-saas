import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, X, Gift, CheckCircle } from 'lucide-react';

interface SubmitToLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitToLibraryModal({ open, onOpenChange }: SubmitToLibraryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['reference-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_categories')
        .select('*')
        .order('label', { ascending: true });
      if (error) throw error;
      return data as { id: string; slug: string; label: string }[];
    },
  });

  const nonFreeCategories = categories.filter(c => c.slug !== 'free');

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('community_submissions').insert({
        user_id: user.id,
        title,
        prompt,
        image_url: imageUrl,
        category_slug: selectedCategory,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `submissions/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('reference-images').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('reference-images').getPublicUrl(path);
      setImageUrl(data.publicUrl);
      setPreviewUrl(data.publicUrl);
    } catch (err) {
      toast({ title: 'Erro no upload', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setImageUrl('');
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetAndClose = () => {
    setTitle('');
    setPrompt('');
    setSelectedCategory('');
    setImageUrl('');
    setPreviewUrl(null);
    setSubmitted(false);
    onOpenChange(false);
  };

  const canSubmit = title.trim() && prompt.trim() && imageUrl && selectedCategory;

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-lg">
        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h3 className="text-xl font-semibold">Imagem enviada!</h3>
            <p className="text-muted-foreground">
              Sua imagem será revisada pela nossa equipe. Você ganhará <strong>2 créditos</strong> quando ela for aprovada!
            </p>
            <Button onClick={resetAndClose}>Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Contribuir com a biblioteca
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground">
              Envie imagens geradas por você aqui no GravyX, ou materiais que o GravyX te ajudou a criar: criativos, flyers, banners...
              <br />
              <strong className="text-foreground">Ganhe 2 créditos grátis</strong> para cada imagem aprovada!
            </div>

            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Retrato cinematográfico" />
              </div>

              <div>
                <Label>Prompt utilizado *</Label>
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Cole aqui o prompt que você usou para gerar a imagem" rows={3} />
              </div>

              <div>
                <Label>Categoria *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {nonFreeCategories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant={selectedCategory === cat.slug ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      onClick={() => setSelectedCategory(cat.slug)}
                    >
                      {cat.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Imagem *</Label>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                {previewUrl ? (
                  <div className="relative mt-2">
                    <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={clearImage}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
                  >
                    <Upload className={`h-8 w-8 mx-auto text-muted-foreground mb-2 ${uploading ? 'animate-pulse' : ''}`} />
                    <p className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Clique para fazer upload'}</p>
                  </button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending}>
                {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar para revisão
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
