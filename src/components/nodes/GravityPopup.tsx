import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface GravityPopupProps { isOpen: boolean; onClose: () => void; initialPrompt: string; initialMediaUrls: string[]; onSave: (prompt: string, mediaUrls: string[]) => void; }

export function GravityPopup({ isOpen, onClose, initialPrompt, initialMediaUrls, onSave }: GravityPopupProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialMediaUrls);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleOpenChange = (open: boolean) => { if (open) { setPrompt(initialPrompt); setMediaUrls(initialMediaUrls); } else { onClose(); } };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0 || !user) return;
    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name} ${t('editor.not_valid_image')}`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} ${t('editor.file_too_large')}`);
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/gravity-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('reference-images').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('reference-images').getPublicUrl(fileName);
        return urlData.publicUrl;
      });
      const urls = await Promise.all(uploadPromises);
      setMediaUrls(prev => [...prev, ...urls]);
      toast({ title: `${urls.length} ${urls.length === 1 ? t('editor.image_added_label') : t('editor.images_added_label')}` });
    } catch (error) { toast({ title: t('editor.upload_error'), description: (error as Error).message, variant: 'destructive' }); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }, [user, toast, t]);

  const handleRemoveMedia = (index: number) => setMediaUrls(prev => prev.filter((_, i) => i !== index));
  const handleSave = () => { onSave(prompt, mediaUrls); onClose(); };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center"><span className="text-white font-bold text-sm">G</span></div>
            {t('editor.configure_gravity')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('editor.base_prompt')}</label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('editor.base_prompt_placeholder')} className="min-h-[100px] bg-muted/30 border-border/50 resize-none" />
            <p className="text-xs text-muted-foreground">{t('editor.base_prompt_hint')}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('editor.reference_media')}</label>
            <div className="grid grid-cols-3 gap-2">
              {mediaUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="relative group aspect-square rounded-lg overflow-hidden border border-border/50">
                  <img src={url} alt={`Media ${index + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => handleRemoveMedia(index)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={cn("aspect-square rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1 transition-all hover:border-violet-500/50 hover:bg-violet-500/5 text-muted-foreground hover:text-violet-400", isUploading && "opacity-50 cursor-not-allowed")}>
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-5 w-5" /><span className="text-xs">{t('editor.add')}</span></>}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
            <p className="text-xs text-muted-foreground">{t('editor.reference_media_hint')}</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500">{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
