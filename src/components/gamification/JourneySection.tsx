import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onRefresh: () => void;
}

export function JourneySection({ unlockedDay, missions, onRefresh }: JourneySectionProps) {
  const { t } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState<number | null>(null);
  const [rewardAnim, setRewardAnim] = useState<{ day: number; text: string } | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  const getMissionState = (day: number) => {
    const mission = missions.find(m => m.day_number === day);
    if (day > unlockedDay) return 'locked';
    if (mission?.reward_claimed) return 'completed';
    if (mission?.completed) return 'reward-pending';
    return 'unlocked';
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
        <h2 className="text-xl font-semibold">🛤 {t('gamification.journey_title')}</h2>
      </div>

      <div className="glass-card p-6 rounded-2xl">
        {/* Journey line */}
        <div className="relative flex items-center justify-between">
          {/* Connecting line */}
          <div className="absolute top-5 left-5 right-5 h-0.5 bg-border/50" />
          <div
            className="absolute top-5 left-5 h-0.5 bg-primary/60 transition-all duration-700"
            style={{ width: `${Math.max(0, ((Math.min(unlockedDay, 10) - 1) / 9) * 100)}%` }}
          />

          {Array.from({ length: 10 }, (_, i) => i + 1).map((day) => {
            const state = getMissionState(day);
            const isDay10 = day === 10;

            return (
              <div key={day} className="relative flex flex-col items-center z-10" style={{ minWidth: '2.5rem' }}>
                {/* Reward animation */}
                {rewardAnim?.day === day && (
                  <RewardAnimation
                    show={true}
                    text={rewardAnim.text}
                    onComplete={() => setRewardAnim(null)}
                  />
                )}

                {/* Circle */}
                <motion.button
                  disabled={state === 'locked' || state === 'completed' || claiming !== null}
                  onClick={() => state === 'reward-pending' && handleClaimReward(day)}
                  whileHover={state === 'reward-pending' ? { scale: 1.1 } : {}}
                  whileTap={state === 'reward-pending' ? { scale: 0.95 } : {}}
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    state === 'locked'
                      ? 'border-border/40 bg-muted/30 text-muted-foreground'
                      : state === 'completed'
                      ? 'border-primary/60 bg-primary/20 text-primary'
                      : state === 'reward-pending'
                      ? 'border-primary bg-primary/10 text-primary cursor-pointer shadow-[0_0_12px_hsl(var(--primary)/0.3)] animate-pulse'
                      : 'border-border bg-background text-muted-foreground'
                  } ${isDay10 && state !== 'locked' ? 'w-12 h-12 shadow-[0_0_16px_hsl(220_100%_50%/0.3)]' : ''}`}
                >
                  {state === 'locked' && <Lock className="h-3.5 w-3.5" />}
                  {state === 'completed' && <Check className="h-4 w-4" />}
                  {state === 'reward-pending' && (claiming === day ? (
                    <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Gift className="h-4 w-4" />
                  ))}
                  {state === 'unlocked' && <span className="text-xs font-semibold">{day}</span>}
                </motion.button>

                {/* Day label */}
                <span className={`mt-1.5 text-[10px] font-medium ${
                  state === 'locked' ? 'text-muted-foreground/50' : 'text-muted-foreground'
                }`}>
                  {isDay10 ? '🎁' : `D${day}`}
                </span>

                {/* Mission tooltip on hover */}
                {state === 'unlocked' && (
                  <span className="mt-0.5 text-[9px] text-muted-foreground/60 text-center max-w-[4rem] line-clamp-2 hidden sm:block">
                    {t(`gamification.mission_${day}_short`)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <JourneyCompleteModal open={showComplete} onOpenChange={setShowComplete} />
    </motion.section>
  );
}
