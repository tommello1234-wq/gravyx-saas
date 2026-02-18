import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Play } from 'lucide-react';

interface WelcomeVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeVideoModal({ open, onOpenChange }: WelcomeVideoModalProps) {
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();

  const handleClose = async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ has_seen_onboarding: true } as any)
        .eq('user_id', user.id);
      await refreshProfile();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Play className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg">{t('welcome.title')}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('welcome.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <iframe
              src="https://www.youtube.com/embed/3_4t5VIHNkY"
              title="Tutorial Gravyx"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>

        <div className="p-6 pt-4">
          <Button onClick={handleClose} className="w-full rounded-full glow-primary gap-2">
            <Play className="h-4 w-4" />
            {t('welcome.got_it')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
