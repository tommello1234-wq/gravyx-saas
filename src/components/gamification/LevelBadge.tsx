import { useState } from 'react';
import { LEVEL_COLORS, LEVEL_BG, type UserLevel } from '@/lib/gamification';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { LevelProgressionPopup } from './LevelProgressionPopup';

interface LevelBadgeProps {
  level: UserLevel;
}

const LEVEL_ICONS: Record<UserLevel, string> = {
  beginner: '🟢',
  creator: '🔵',
  strategist: '🟣',
  orchestrator: '🟡',
  architect: '🔥',
};

export function LevelBadge({ level }: LevelBadgeProps) {
  const { t } = useLanguage();
  const [showPopup, setShowPopup] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowPopup(true)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full ${LEVEL_BG[level]} cursor-pointer select-none hover:opacity-80 transition-opacity`}
            >
              <span className="text-xs">{LEVEL_ICONS[level]}</span>
              <span className={`text-xs font-semibold ${LEVEL_COLORS[level]}`}>
                {t(`gamification.level_${level}`)}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{t('gamification.level_tooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <LevelProgressionPopup open={showPopup} onOpenChange={setShowPopup} />
    </>
  );
}
