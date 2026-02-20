import { BADGES } from '@/lib/gamification';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

interface BadgesSectionProps {
  earnedBadgeIds: string[];
}

export function BadgesSection({ earnedBadgeIds }: BadgesSectionProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        🏅 {t('gamification.badges_title')}
      </h3>
      <div className="flex flex-wrap gap-2">
        <TooltipProvider>
          {BADGES.map((badge) => {
            const earned = earnedBadgeIds.includes(badge.id);
            return (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border transition-all ${
                      earned
                        ? 'border-primary/40 bg-primary/10 shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
                        : 'border-border/40 bg-muted/50 opacity-40 grayscale'
                    }`}
                  >
                    {badge.icon}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-medium">{t(`gamification.badge_${badge.id}`)}</p>
                  {!earned && <p className="text-xs text-muted-foreground">{t('gamification.badge_locked')}</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
