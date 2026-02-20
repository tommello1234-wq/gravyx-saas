import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

interface StreakIndicatorProps {
  streak: number;
  justIncreased: boolean;
}

export function StreakIndicator({ streak, justIncreased }: StreakIndicatorProps) {
  const { t } = useLanguage();

  if (streak <= 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 cursor-default select-none">
            <AnimatePresence>
              <motion.div
                key={streak}
                initial={justIncreased ? { scale: 1.6, rotate: -10 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                <Flame className="h-4 w-4 text-orange-400" />
              </motion.div>
            </AnimatePresence>
            <motion.span
              key={`count-${streak}`}
              initial={justIncreased ? { scale: 1.4 } : false}
              animate={{ scale: 1 }}
              className="text-sm font-bold text-orange-400 tabular-nums"
            >
              {streak}
            </motion.span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{t('gamification.streak_tooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
