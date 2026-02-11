import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { subDays, subMonths, startOfDay, format, differenceInDays } from 'date-fns';

export type Period = '7d' | '30d' | '90d' | '12m';

function getPeriodDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case '7d': return subDays(now, 7);
    case '30d': return subDays(now, 30);
    case '90d': return subDays(now, 90);
    case '12m': return subMonths(now, 12);
  }
}

function getPreviousPeriodDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case '7d': return subDays(now, 14);
    case '30d': return subDays(now, 60);
    case '90d': return subDays(now, 180);
    case '12m': return subMonths(now, 24);
  }
}

export interface DashboardData {
  // Raw data
  profiles: any[];
  generations: any[];
  jobs: any[];
  purchases: any[];
  authUsers: Record<string, { last_sign_in_at: string | null }>;

  // KPIs
  totalUsers: number;
  activeUsers: number;
  totalImages: number;
  estimatedCreditsConsumed: number;
  totalRevenue: number;
  activityRate: number;

  // Growth (vs previous period)
  userGrowth: number;
  activeUserGrowth: number;
  imageGrowth: number;
  revenueGrowth: number;

  // Chart data
  activityByDay: { date: string; images: number; users: number; credits: number }[];

  // Plan distribution
  planDistribution: { name: string; value: number }[];

  // Top users
  topUsers: { user_id: string; email: string; display_name: string | null; tier: string; credits: number; total_images: number }[];

  // Platform performance
  totalJobs: number;
  jobErrors24h: number;
  jobSuccessRate: number;

  // Alerts
  alerts: { type: 'error' | 'warning' | 'info'; message: string }[];

  // Loading
  isLoading: boolean;
}

export function useAdminDashboard(period: Period): DashboardData {
  const periodDate = getPeriodDate(period);
  const previousPeriodDate = getPreviousPeriodDate(period);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['admin-dashboard-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: generations = [], isLoading: generationsLoading } = useQuery({
    queryKey: ['admin-dashboard-generations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('generations').select('id, user_id, created_at, status');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['admin-dashboard-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('id, user_id, status, error, created_at, started_at, finished_at');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: ['admin-dashboard-purchases'],
    queryFn: async () => {
      const { data, error } = await supabase.from('credit_purchases').select('*');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: authUsers = {}, isLoading: authLoading } = useQuery({
    queryKey: ['admin-dashboard-auth'],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'dashboard-stats' },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (response.error) return {};
      return (response.data?.users || {}) as Record<string, { last_sign_in_at: string | null }>;
    },
    refetchInterval: 60000,
  });

  const isLoading = profilesLoading || generationsLoading || jobsLoading || purchasesLoading || authLoading;

  return useMemo(() => {
    const now = new Date();
    const periodStart = periodDate;
    const prevStart = previousPeriodDate;

    // Filter by period
    const periodGenerations = generations.filter(g => new Date(g.created_at) >= periodStart);
    const prevGenerations = generations.filter(g => {
      const d = new Date(g.created_at);
      return d >= prevStart && d < periodStart;
    });

    const periodProfiles = profiles.filter(p => new Date(p.created_at) >= periodStart);
    const prevProfiles = profiles.filter(p => {
      const d = new Date(p.created_at);
      return d >= prevStart && d < periodStart;
    });

    const periodPurchases = purchases.filter(p => new Date(p.created_at) >= periodStart);
    const prevPurchases = purchases.filter(p => {
      const d = new Date(p.created_at);
      return d >= prevStart && d < periodStart;
    });

    // KPIs
    const totalUsers = profiles.length;
    const activeUserIds = new Set(periodGenerations.map(g => g.user_id));
    const activeUsers = activeUserIds.size;
    const totalImages = generations.length;
    const periodImages = periodGenerations.length;

    // Estimated credits consumed: (initial_credits * users + purchased) - current_balance
    const totalCurrentCredits = profiles.reduce((sum, p) => sum + (p.credits || 0), 0);
    const totalPurchasedCredits = purchases.reduce((sum, p) => sum + (p.credits_added || 0), 0);
    const estimatedCreditsConsumed = Math.max(0, (5 * totalUsers + totalPurchasedCredits) - totalCurrentCredits);

    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const periodRevenue = periodPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
    const prevRevenue = prevPurchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

    const usersWithImages = new Set(generations.map(g => g.user_id)).size;
    const activityRate = totalUsers > 0 ? (usersWithImages / totalUsers) * 100 : 0;

    // Growth calculations
    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const userGrowth = calcGrowth(periodProfiles.length, prevProfiles.length);
    const prevActiveUsers = new Set(prevGenerations.map(g => g.user_id)).size;
    const activeUserGrowth = calcGrowth(activeUsers, prevActiveUsers);
    const imageGrowth = calcGrowth(periodImages, prevGenerations.length);
    const revenueGrowth = calcGrowth(periodRevenue, prevRevenue);

    // Activity by day chart data
    const days = period === '12m' ? 365 : parseInt(period);
    const numDays = period === '12m' ? 365 : parseInt(period);
    const activityByDay: { date: string; images: number; users: number; credits: number }[] = [];

    if (period === '12m') {
      // Group by month
      const monthMap = new Map<string, { images: number; users: Set<string>; credits: number }>();
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(now, i);
        const key = format(d, 'yyyy-MM');
        monthMap.set(key, { images: 0, users: new Set(), credits: 0 });
      }
      generations.filter(g => new Date(g.created_at) >= periodStart).forEach(g => {
        const key = format(new Date(g.created_at), 'yyyy-MM');
        const entry = monthMap.get(key);
        if (entry) { entry.images++; entry.users.add(g.user_id); entry.credits++; }
      });
      monthMap.forEach((v, k) => {
        activityByDay.push({ date: k, images: v.images, users: v.users.size, credits: v.credits });
      });
    } else {
      const dayMap = new Map<string, { images: number; users: Set<string>; credits: number }>();
      for (let i = numDays - 1; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(startOfDay(d), 'yyyy-MM-dd');
        dayMap.set(key, { images: 0, users: new Set(), credits: 0 });
      }
      periodGenerations.forEach(g => {
        const key = format(startOfDay(new Date(g.created_at)), 'yyyy-MM-dd');
        const entry = dayMap.get(key);
        if (entry) { entry.images++; entry.users.add(g.user_id); entry.credits++; }
      });
      // New users per day
      periodProfiles.forEach(p => {
        const key = format(startOfDay(new Date(p.created_at)), 'yyyy-MM-dd');
        const entry = dayMap.get(key);
        if (entry) entry.users.add('new_' + p.user_id);
      });
      dayMap.forEach((v, k) => {
        activityByDay.push({ date: k, images: v.images, users: v.users.size, credits: v.credits });
      });
    }

    // Plan distribution
    const tierCounts = new Map<string, number>();
    profiles.forEach(p => {
      const tier = p.tier || 'free';
      tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
    });
    const planDistribution = Array.from(tierCounts.entries()).map(([name, value]) => ({ name, value }));

    // Top users by images generated in period
    const userImageCounts = new Map<string, number>();
    periodGenerations.forEach(g => {
      userImageCounts.set(g.user_id, (userImageCounts.get(g.user_id) || 0) + 1);
    });
    const sortedUsers = Array.from(userImageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topUsers = sortedUsers.map(([userId, total]) => {
      const profile = profiles.find(p => p.user_id === userId);
      return {
        user_id: userId,
        email: profile?.email || 'N/A',
        display_name: profile?.display_name || null,
        tier: profile?.tier || 'free',
        credits: profile?.credits || 0,
        total_images: total,
      };
    });

    // Platform performance
    const totalJobs = jobs.length;
    const last24h = subDays(now, 1);
    const jobs24h = jobs.filter(j => new Date(j.created_at) >= last24h);
    const jobErrors24h = jobs24h.filter(j => j.status === 'failed' || j.error).length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const jobSuccessRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 100;

    // Alerts
    const alerts: { type: 'error' | 'warning' | 'info'; message: string }[] = [];

    // Error spike alert
    if (jobs24h.length > 0) {
      const errorRate = jobErrors24h / jobs24h.length;
      if (errorRate > 0.1) {
        alerts.push({ type: 'error', message: `⚠️ Taxa de erros alta: ${(errorRate * 100).toFixed(0)}% dos jobs nas últimas 24h falharam` });
      }
    }

    // Usage spike
    const avgDaily = periodImages / Math.max(1, differenceInDays(now, periodStart));
    const todayImages = generations.filter(g => new Date(g.created_at) >= startOfDay(now)).length;
    if (todayImages > avgDaily * 2 && todayImages > 5) {
      alerts.push({ type: 'info', message: `🔥 Pico de uso: ${todayImages} imagens geradas hoje (média: ${avgDaily.toFixed(0)}/dia)` });
    }

    // Users with 0 credits
    const zeroCreditsCount = profiles.filter(p => (p.credits || 0) === 0).length;
    if (zeroCreditsCount > 0) {
      alerts.push({ type: 'warning', message: `💳 ${zeroCreditsCount} usuário(s) com 0 créditos — possível oportunidade de upgrade` });
    }

    return {
      profiles, generations, jobs, purchases, authUsers,
      totalUsers, activeUsers, totalImages, estimatedCreditsConsumed, totalRevenue, activityRate,
      userGrowth, activeUserGrowth, imageGrowth, revenueGrowth,
      activityByDay, planDistribution, topUsers,
      totalJobs, jobErrors24h, jobSuccessRate,
      alerts, isLoading,
    };
  }, [profiles, generations, jobs, purchases, authUsers, period, isLoading]);
}
