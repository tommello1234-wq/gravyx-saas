import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calculateLevel, checkMissionCompletion, type UserLevel, type MissionCheckData } from '@/lib/gamification';

interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_login_date: string | null;
}

interface JourneyData {
  journey_start_date: string | null;
  current_day: number;
}

interface MissionData {
  day_number: number;
  completed: boolean;
  reward_claimed: boolean;
}

interface BadgeData {
  badge_id: string;
  earned_at: string;
}

export function useGamification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [streakJustIncreased, setStreakJustIncreased] = useState(false);

  // Streak
  const { data: streak } = useQuery({
    queryKey: ['user-streak', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as StreakData | null;
    },
    enabled: !!user,
  });

  // Journey
  const { data: journey } = useQuery({
    queryKey: ['user-journey', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_journey')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as JourneyData | null;
    },
    enabled: !!user,
  });

  // Missions
  const { data: missions } = useQuery({
    queryKey: ['user-missions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_missions')
        .select('day_number, completed, reward_claimed')
        .eq('user_id', user!.id)
        .order('day_number');
      if (error) throw error;
      return (data ?? []) as MissionData[];
    },
    enabled: !!user,
  });

  // Badges
  const { data: badges } = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []) as BadgeData[];
    },
    enabled: !!user,
  });

  // Stats for level calculation + mission check data
  const { data: levelStats } = useQuery({
    queryKey: ['gamification-level-stats', user?.id],
    queryFn: async () => {
      const [profileRes, projRes, projData, gensByProject] = await Promise.all([
        supabase.from('profiles').select('total_generations').eq('user_id', user!.id).single(),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('projects').select('id, canvas_state, created_at, updated_at').eq('user_id', user!.id),
        supabase.from('generations').select('project_id').eq('user_id', user!.id).eq('status', 'completed'),
      ]);
      const projects = (projData.data ?? []) as Array<{ id: string; canvas_state: any; created_at: string; updated_at: string }>;
      const usedGravity = projects.some((p) => {
        const cs = p.canvas_state as any;
        return cs?.nodes?.some((n: any) => n.type === 'gravity');
      });

      // Count generations per project
      const genCounts: Record<string, number> = {};
      for (const g of (gensByProject.data ?? []) as Array<{ project_id: string | null }>) {
        if (g.project_id) {
          genCounts[g.project_id] = (genCounts[g.project_id] || 0) + 1;
        }
      }

      return {
        generations: (profileRes.data as any)?.total_generations ?? 0,
        projects: projRes.count ?? 0,
        usedGravity,
        projectsData: projects,
        generationsByProject: genCounts,
      };
    },
    enabled: !!user,
  });

  const currentLevel: UserLevel = levelStats
    ? calculateLevel(levelStats.generations, levelStats.projects, levelStats.usedGravity, streak?.longest_streak ?? 0)
    : 'beginner';

  // Update streak on mount
  useEffect(() => {
    if (!user || streak === undefined) return;
    const today = new Date().toISOString().split('T')[0];

    const updateStreak = async () => {
      if (!streak) {
        // No record - create with streak = 1
        await supabase.from('user_streaks').insert({
          user_id: user.id,
          current_streak: 1,
          longest_streak: 1,
          last_login_date: today,
        } as any);
        setStreakJustIncreased(true);
        queryClient.invalidateQueries({ queryKey: ['user-streak', user.id] });
        return;
      }

      if (streak.last_login_date === today) return; // Already logged today

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak: number;
      if (streak.last_login_date === yesterdayStr) {
        newStreak = streak.current_streak + 1;
        setStreakJustIncreased(true);
      } else {
        newStreak = 1;
      }

      const newLongest = Math.max(newStreak, streak.longest_streak);

      await supabase.from('user_streaks').update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_login_date: today,
        updated_at: new Date().toISOString(),
      } as any).eq('user_id', user.id);

      queryClient.invalidateQueries({ queryKey: ['user-streak', user.id] });
    };

    updateStreak();
  }, [user, streak]);

  // Initialize journey on first visit
  useEffect(() => {
    if (!user || journey === undefined) return;
    if (journey) return; // Already initialized

    const today = new Date().toISOString().split('T')[0];
    supabase.from('user_journey').insert({
      user_id: user.id,
      journey_start_date: today,
      current_day: 1,
    } as any).then(() => {
      queryClient.invalidateQueries({ queryKey: ['user-journey', user.id] });
    });
  }, [user, journey]);

  // Calculate unlocked day
  const unlockedDay = (() => {
    if (!journey?.journey_start_date) return 1;
    const start = new Date(journey.journey_start_date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(Math.max(diffDays, 1), 10);
  })();

  const refreshAll = useCallback(() => {
    if (!user) return;
    queryClient.invalidateQueries({ queryKey: ['user-streak', user.id] });
    queryClient.invalidateQueries({ queryKey: ['user-journey', user.id] });
    queryClient.invalidateQueries({ queryKey: ['user-missions', user.id] });
    queryClient.invalidateQueries({ queryKey: ['user-badges', user.id] });
    queryClient.invalidateQueries({ queryKey: ['gamification-level-stats', user.id] });
  }, [user, queryClient]);

  // Mission completion status (client-side check)
  const missionCompletionStatus = useMemo<Record<number, boolean>>(() => {
    if (!levelStats || !journey) return {};
    const checkData: MissionCheckData = {
      totalGenerations: levelStats.generations,
      projectCount: levelStats.projects,
      projects: levelStats.projectsData ?? [],
      generationsByProject: levelStats.generationsByProject ?? {},
      journeyStartDate: journey?.journey_start_date ?? null,
    };
    const status: Record<number, boolean> = {};
    for (let day = 1; day <= 10; day++) {
      status[day] = checkMissionCompletion(day, checkData);
    }
    return status;
  }, [levelStats, journey]);

  return {
    streak: streak ?? { current_streak: 0, longest_streak: 0, last_login_date: null },
    streakJustIncreased,
    journey,
    missions: missions ?? [],
    badges: badges ?? [],
    unlockedDay,
    currentLevel,
    levelStats: levelStats ?? { generations: 0, projects: 0, usedGravity: false },
    missionCompletionStatus,
    refreshAll,
  };
}
