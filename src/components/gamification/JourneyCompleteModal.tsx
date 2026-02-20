import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface JourneyCompleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JourneyCompleteModal({ open, onOpenChange }: JourneyCompleteModalProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg text-center border-primary/30 bg-background/95 backdrop-blur-xl">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="py-6 space-y-6"
        >
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold">{t('gamification.journey_complete_title')}</h2>
          <p className="text-muted-foreground">{t('gamification.journey_complete_desc')}</p>
          
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-lg font-semibold">🎓 {t('gamification.journey_reward')}</p>
          </div>

          <Button
            size="lg"
            className="rounded-full glow-primary gap-2"
            onClick={() => window.open('https://app.upwardacademy.com.br/', '_blank')}
          >
            {t('gamification.access_training')}
          </Button>
          
          <p className="text-xs text-muted-foreground">{t('gamification.pro_access_hint')}</p>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
