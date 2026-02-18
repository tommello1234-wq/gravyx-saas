import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Upload, X } from 'lucide-react';

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileModal({ open, onOpenChange }: EditProfileModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [open, profile]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('user-media').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('user-media').getPublicUrl(fileName);
      setAvatarUrl(urlData.publicUrl);
      toast({ title: t('profile.photo_sent') });
    } catch (error) {
      toast({ title: t('profile.upload_error'), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAvatarUpload(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ display_name: displayName || null, avatar_url: avatarUrl }).eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: t('profile.profile_updated') });
      onOpenChange(false);
    } catch (error) {
      toast({ title: t('profile.error_save'), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const clearAvatar = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentDisplayName = displayName || profile?.email?.split('@')[0] || 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profile.edit_profile')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={currentDisplayName} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{currentDisplayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {avatarUrl && (
                <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-7 w-7 rounded-full" onClick={clearAvatar}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? t('profile.uploading') : t('profile.change_photo')}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.display_name')}</Label>
            <Input id="displayName" placeholder={t('profile.display_name_placeholder')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('profile.display_name_hint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('auth.email')}</Label>
            <Input value={profile?.email || ''} disabled className="bg-muted" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
