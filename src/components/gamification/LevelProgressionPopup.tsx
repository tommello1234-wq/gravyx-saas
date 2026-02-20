import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGamification } from '@/hooks/useGamification';
import { LEVELS, LEVEL_COLORS, LEVEL_BG, getLevelProgress, getNextLevel, type UserLevel } from '@/lib/gamification';

const LEVEL_ICONS: Record<UserLevel, string> = {
  beginner: '🟢',
  creator: '🔵',
  strategist: '🟣',
  orchestrator: '🟡',
  architect: '🔥',
};

interface LevelProgressionPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LevelProgressionPopup({ open, onOpenChange }: LevelProgressionPopupProps) {
  const { t } = useLanguage();
  const { currentLevel, levelStats, streak } = useGamification();

  const progress = getLevelProgress(currentLevel, levelStats.generations, levelStats.projects);
  const nextLevel = getNextLevel(currentLevel);
  const currentIdx = LEVELS.findIndex(l => l.id === currentLevel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {LEVEL_ICONS[currentLevel]} {t(`gamification.level_${currentLevel}`)}
          </DialogTitle>
          <DialogDescription>
            {t('gamification.level_progression_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Current progress to next level */}
          {nextLevel && (
            <div className="glass-card p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('gamification.next_level')}</span>
                <span className={`font-semibold ${LEVEL_COLORS[nextLevel.id]}`}>
                  {LEVEL_ICONS[nextLevel.id]} {t(`gamification.level_${nextLevel.id}`)}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t('gamification.req_generations')}</span>
                  <span className={levelStats.generations >= nextLevel.minGenerations ? 'text-primary font-medium' : ''}>
                    {levelStats.generations} / {nextLevel.minGenerations}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('gamification.req_projects')}</span>
                  <span className={levelStats.projects >= nextLevel.minProjects ? 'text-primary font-medium' : ''}>
                    {levelStats.projects} / {nextLevel.minProjects}
                  </span>
                </div>
                {nextLevel.extraRequirement === 'gravity' && (
                  <div className="flex justify-between">
                    <span>{t('gamification.req_gravity')}</span>
                    <span className={levelStats.usedGravity ? 'text-primary font-medium' : ''}>
                      {levelStats.usedGravity ? '✓' : '✗'}
                    </span>
                  </div>
                )}
                {nextLevel.extraRequirement === 'streak30' && (
                  <div className="flex justify-between">
                    <span>{t('gamification.req_streak30')}</span>
                    <span className={streak.longest_streak >= 30 ? 'text-primary font-medium' : ''}>
                      {streak.longest_streak} / 30
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All levels */}
          <div className="space-y-2">
            {LEVELS.map((level, idx) => {
              const reached = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <motion.div
                  key={level.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? `${LEVEL_BG[level.id]} border-primary/30`
                      : reached
                      ? 'border-border/50 bg-muted/20'
                      : 'border-border/20 bg-muted/10 opacity-60'
                  }`}
                >
                  <span className="text-lg">{LEVEL_ICONS[level.id]}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${reached ? LEVEL_COLORS[level.id] : 'text-muted-foreground'}`}>
                      {t(`gamification.level_${level.id}`)}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                          {t('gamification.current')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {level.minGenerations} {t('gamification.images')} · {level.minProjects} {t('gamification.projects_label')}
                      {level.extraRequirement === 'gravity' && ` · ${t('gamification.req_gravity_short')}`}
                      {level.extraRequirement === 'streak30' && ` · ${t('gamification.req_streak30_short')}`}
                    </p>
                  </div>
                  {reached ? (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
