import { LEVEL_COLORS, LEVEL_BG, type UserLevel } from '@/lib/gamification';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${LEVEL_BG[level]} cursor-default select-none`}>
            <span className="text-xs">{LEVEL_ICONS[level]}</span>
            <span className={`text-xs font-semibold ${LEVEL_COLORS[level]}`}>
              {t(`gamification.level_${level}`)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{t('gamification.level_tooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
