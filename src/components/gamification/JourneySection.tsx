import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, Gift, Circle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MISSIONS } from '@/lib/gamification';
import { RewardAnimation } from './RewardAnimation';
import { JourneyCompleteModal } from './JourneyCompleteModal';

interface MissionData {
  day_number: number;
  completed: boolean;
  reward_claimed: boolean;
}

interface JourneySectionProps {
  unlockedDay: number;
  missions: MissionData[];
  missionCompletionStatus: Record<number, boolean>;
  onRefresh: () => void;
}

type MissionState = 'locked' | 'todo' | 'reward-pending' | 'claimed';

export function JourneySection({ unlockedDay, missions, missionCompletionStatus, onRefresh }: JourneySectionProps) {
  const { t } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState<number | null>(null);
  const [rewardAnim, setRewardAnim] = useState<{ day: number; text: string } | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  const getMissionState = (day: number): MissionState => {
    if (day > unlockedDay) return 'locked';
    const mission = missions.find(m => m.day_number === day);
    if (mission?.reward_claimed) return 'claimed';
    const isCompleted = missionCompletionStatus[day] ?? false;
    if (isCompleted) return 'reward-pending';
    return 'todo';
  };

  const handleClaimReward = async (day: number) => {
    if (!user) return;
    setClaiming(day);
    try {
      const { data, error } = await supabase.functions.invoke('claim-reward', {
        body: { day_number: day },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const missionDef = MISSIONS.find(m => m.day === day);
      if (missionDef?.rewardCredits) {
        setRewardAnim({ day, text: `+${missionDef.rewardCredits} ${t('header.credits')}` });
      } else if (missionDef?.badgeId) {
        setRewardAnim({ day, text: `🏅 ${t(`gamification.badge_${missionDef.badgeId}`)}` });
      }

      await refreshProfile();
      onRefresh();

      if (day === 10) {
        setTimeout(() => setShowComplete(true), 1500);
      }
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setClaiming(null);
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-2 mb-5">
        <img src="/gravyx-icon.png" alt="Gravyx" className="h-6 w-6" />
        <h2 className="text-xl font-semibold">{t('gamification.journey_title')}</h2>
      </div>

      <div className="glass-card p-6 rounded-2xl">
        {/* Journey line */}
        <div className="relative flex items-center justify-between">
          {/* Connecting line - centered with circles, behind them */}
          <div className="absolute top-1/2 -translate-y-1/2 left-[1.25rem] right-[1.25rem] h-[2px] bg-border/30 -z-0" />
          <div
            className="absolute top-1/2 -translate-y-1/2 left-[1.25rem] h-[2px] bg-primary/60 transition-all duration-700 -z-0"
            style={{ width: `calc(${Math.max(0, ((Math.min(unlockedDay, 10) - 1) / 9) * 100)}% - 2.5rem)` }}
          />

          {Array.from({ length: 10 }, (_, i) => i + 1).map((day) => {
            const state = getMissionState(day);
            const isDay10 = day === 10;
            const missionDef = MISSIONS.find(m => m.day === day);

            return (
              <Popover key={day}>
                <PopoverTrigger asChild>
                  <div className="relative flex flex-col items-center z-[1] cursor-pointer" style={{ minWidth: '2.5rem' }}>
                    {/* Reward animation */}
                    {rewardAnim?.day === day && (
                      <RewardAnimation
                        show={true}
                        text={rewardAnim.text}
                        onComplete={() => setRewardAnim(null)}
                      />
                    )}

                    {/* Circle */}
                    <motion.div
                      whileHover={state !== 'locked' ? { scale: 1.1 } : {}}
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        state === 'locked'
                          ? 'border-border/40 bg-muted/30 text-muted-foreground'
                          : state === 'claimed'
                          ? 'border-primary/60 bg-primary/20 text-primary'
                          : state === 'reward-pending'
                          ? 'border-primary bg-primary/10 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)] animate-pulse'
                          : 'border-border bg-background text-muted-foreground'
                      } ${isDay10 ? 'w-12 h-12' : ''} ${
                        isDay10 && state !== 'locked'
                          ? 'border-yellow-400/80 shadow-[0_0_20px_hsl(45_100%_50%/0.4)]'
                          : ''
                      }`}
                    >
                      {state === 'locked' && <Lock className="h-3.5 w-3.5" />}
                      {state === 'claimed' && <Check className="h-4 w-4" />}
                      {state === 'todo' && <Circle className="h-4 w-4" />}
                      {state === 'reward-pending' && (
                        isDay10
                          ? <Sparkles className="h-4 w-4 text-yellow-400" />
                          : <Gift className="h-4 w-4" />
                      )}
                    </motion.div>

                    {/* Day label */}
                    <span className={`mt-1.5 text-[10px] font-medium whitespace-nowrap ${
                      state === 'locked' ? 'text-muted-foreground/50' : 'text-muted-foreground'
                    }`}>
                      {isDay10 ? '🎁' : `Dia ${String(day).padStart(2, '0')}`}
                    </span>
                  </div>
                </PopoverTrigger>

                {/* Popover with mission info - shown for ALL days */}
                <PopoverContent side="bottom" className={`w-64 p-3 ${isDay10 && state !== 'locked' ? 'border-yellow-400/50' : ''}`} align="center">
                  <div className="space-y-2">
                    {/* Title */}
                    <p className="text-xs font-semibold">
                      {isDay10 && state !== 'locked' ? t('gamification.day10_surprise') + ' ' : ''}
                      {t(`gamification.mission_${day}_title`)}
                    </p>

                    {/* Status badge */}
                    {state === 'locked' && (
                      <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> {t('gamification.mission_locked')}
                      </p>
                    )}

                    {/* Requirement description */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {t('gamification.mission_requirement')}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isDay10 && state !== 'locked'
                          ? t('gamification.day10_desc')
                          : t(`gamification.mission_${day}_desc`)}
                      </p>
                    </div>

                    {/* Reward info */}
                    <div className="text-[11px] font-medium text-primary">
                      {missionDef?.rewardCredits ? `🎯 +${missionDef.rewardCredits} ${t('header.credits')}` : ''}
                      {missionDef?.badgeId ? `🏅 ${t(`gamification.badge_${missionDef.badgeId}`)}` : ''}
                    </div>

                    {/* Status + Action */}
                    {state === 'claimed' && (
                      <p className="text-[10px] text-primary/70">✓ {t('gamification.mission_claimed')}</p>
                    )}

                    {state === 'todo' && (
                      <p className="text-[10px] text-muted-foreground/70">
                        {t('gamification.mission_todo')}
                      </p>
                    )}

                    {state === 'reward-pending' && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-primary font-medium">
                          {t('gamification.mission_completed')}
                        </p>
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs"
                          disabled={claiming !== null}
                          onClick={() => handleClaimReward(day)}
                        >
                          {claiming === day ? (
                            <div className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <Gift className="h-3 w-3 mr-1" />
                          )}
                          {t('gamification.claim_reward')}
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>

      <JourneyCompleteModal open={showComplete} onOpenChange={setShowComplete} />
    </motion.section>
  );
}
