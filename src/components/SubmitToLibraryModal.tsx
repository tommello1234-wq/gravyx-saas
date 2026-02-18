import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload, Loader2, X, Gift, CheckCircle } from 'lucide-react';

interface SubmitToLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitToLibraryModal({ open, onOpenChange }: SubmitToLibraryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
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
      const { data, error } = await supabase.from('reference_categories').select('*').order('label', { ascending: true });
      if (error) throw error;
      return data as { id: string; slug: string; label: string }[];
    },
  });

  const nonFreeCategories = categories.filter(c => c.slug !== 'free');

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('community_submissions').insert({
        user_id: user.id, title, prompt, image_url: imageUrl, category_slug: selectedCategory,
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (error) => toast({ title: t('submit.error_submit'), description: error.message, variant: 'destructive' }),
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
      toast({ title: t('editor.upload_error'), description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => { setImageUrl(''); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const resetAndClose = () => {
    setTitle(''); setPrompt(''); setSelectedCategory(''); setImageUrl(''); setPreviewUrl(null); setSubmitted(false); onOpenChange(false);
  };

  const canSubmit = title.trim() && prompt.trim() && imageUrl && selectedCategory;

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-lg">
        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h3 className="text-xl font-semibold">{t('submit.image_sent')}</h3>
            <p className="text-muted-foreground">
              {t('submit.review_message')} <strong>{t('submit.credits_reward')}</strong> {t('submit.when_approved')}
            </p>
            <Button onClick={resetAndClose}>{t('submit.close')}</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                {t('submit.contribute')}
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground">
              {t('submit.instructions')}
              <br />
              <strong className="text-foreground">{t('submit.earn_credits')}</strong> {t('submit.per_approved')}
            </div>

            <div className="space-y-4">
              <div>
                <Label>{t('submit.title')}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('submit.title_placeholder')} />
              </div>
              <div>
                <Label>{t('submit.prompt_used')}</Label>
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('submit.prompt_placeholder')} rows={3} />
              </div>
              <div>
                <Label>{t('submit.category')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {nonFreeCategories.map((cat) => (
                    <Badge key={cat.id} variant={selectedCategory === cat.slug ? 'default' : 'outline'} className="cursor-pointer transition-colors" onClick={() => setSelectedCategory(cat.slug)}>
                      {cat.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t('submit.image')}</Label>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                {previewUrl ? (
                  <div className="relative mt-2">
                    <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={clearImage}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <Upload className={`h-8 w-8 mx-auto text-muted-foreground mb-2 ${uploading ? 'animate-pulse' : ''}`} />
                    <p className="text-sm text-muted-foreground">{uploading ? t('profile.uploading') : t('submit.click_to_upload')}</p>
                  </button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending}>
                {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('submit.submit_for_review')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
