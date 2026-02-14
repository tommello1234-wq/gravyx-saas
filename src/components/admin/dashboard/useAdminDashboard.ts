import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { subDays, subMonths, startOfDay, format, differenceInDays } from 'date-fns';
import { ESTIMATED_COST_PER_IMAGE_USD, USD_TO_BRL_RATE, PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';
import type { AdminPeriod, AdminTierFilter } from '../AdminContext';

export type Period = AdminPeriod;

function getPeriodRange(period: AdminPeriod, customRange?: { start: Date; end: Date }): { start: Date; prevStart: Date } {
  const now = new Date();
  switch (period) {
    case 'today': return { start: startOfDay(now), prevStart: subDays(startOfDay(now), 1) };
    case '7d': return { start: subDays(now, 7), prevStart: subDays(now, 14) };
    case '30d': return { start: subDays(now, 30), prevStart: subDays(now, 60) };
    case '90d': return { start: subDays(now, 90), prevStart: subDays(now, 180) };
    case 'custom': {
      if (!customRange) return { start: subDays(now, 30), prevStart: subDays(now, 60) };
      const days = differenceInDays(customRange.end, customRange.start);
      return { start: customRange.start, prevStart: subDays(customRange.start, days) };
    }
  }
}

export interface DashboardData {
  profiles: any[];
  generations: any[];
  jobs: any[];
  purchases: any[];
  authUsers: Record<string, { last_sign_in_at: string | null }>;

  // Operations KPIs
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  paidSubscriptions: number;
  newPaidSubscriptions: number;
  estimatedChurn: number;
  totalImages: number;
  periodImages: number;
  creditsConsumed: number;
  creditsRemaining: number;
  avgImagesPerActiveUser: number;
  topUser: { name: string; count: number } | null;
  activityRate: number;

  // Growth
  userGrowth: number;
  activeUserGrowth: number;
  imageGrowth: number;
  revenueGrowth: number;
  newUserGrowth: number;

  // Chart data
  activityByDay: { date: string; images: number; users: number; credits: number }[];

  // Plan distribution
  planDistribution: { name: string; value: number }[];

  // Top users
  topUsers: { user_id: string; email: string; display_name: string | null; tier: string; credits: number; total_images: number }[];

  // Financial
  grossRevenue: number;
  periodRevenue: number;
  operationalCost: number;
  periodCost: number;
  grossProfit: number;
  margin: number;
  estimatedMRR: number;
  estimatedARR: number;
  estimatedOperationalCostUSD: number;
  estimatedOperationalCostBRL: number;
  profitMarginBRL: number;

  // Financial by day
  revenueByDay: { date: string; revenue: number; cost: number; profit: number }[];

  // Financial by plan
  financialByPlan: { plan: string; activeSubscriptions: number; newSubscriptions: number; cancellations: number; revenue: number; images: number; cost: number; profit: number; margin: number }[];

  // Revenue by plan (for charts)
  revenueByPlan: { name: string; value: number }[];

  // Platform performance
  totalJobs: number;
  jobErrors24h: number;
  jobSuccessRate: number;

  // Alerts
  alerts: { type: 'error' | 'warning' | 'info'; message: string }[];

  totalRevenue: number;
  estimatedCreditsConsumed: number;

  isLoading: boolean;
}

export function useAdminDashboard(
  period: AdminPeriod,
  tierFilter: AdminTierFilter = 'all',
  customRange?: { start: Date; end: Date },
  costPerImage: number = 0.30
): DashboardData {
  const { start: periodStart, prevStart } = getPeriodRange(period, customRange);

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
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('generations')
          .select('id, user_id, created_at, status')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    refetchInterval: 60000,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['admin-dashboard-jobs'],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, user_id, status, error, created_at, started_at, finished_at')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return all;
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

    // Filter profiles by tier
    const filteredProfiles = tierFilter === 'all' ? profiles : profiles.filter(p => p.tier === tierFilter);
    const filteredUserIds = new Set(filteredProfiles.map(p => p.user_id));

    // Filter generations by tier-filtered users
    const filteredGenerations = tierFilter === 'all' ? generations : generations.filter(g => filteredUserIds.has(g.user_id));
    const filteredPurchases = tierFilter === 'all' ? purchases : purchases.filter(p => filteredUserIds.has(p.user_id));

    // Period filtering
    const periodGens = filteredGenerations.filter(g => new Date(g.created_at) >= periodStart);
    const prevGens = filteredGenerations.filter(g => { const d = new Date(g.created_at); return d >= prevStart && d < periodStart; });

    const periodProfiles = filteredProfiles.filter(p => new Date(p.created_at) >= periodStart);
    const prevProfilesArr = filteredProfiles.filter(p => { const d = new Date(p.created_at); return d >= prevStart && d < periodStart; });

    const periodPurchases = filteredPurchases.filter(p => new Date(p.created_at) >= periodStart);
    const prevPurchasesArr = filteredPurchases.filter(p => { const d = new Date(p.created_at); return d >= prevStart && d < periodStart; });

    // Operations KPIs
    const totalUsers = filteredProfiles.length;
    const activeUserIds = new Set(periodGens.map(g => g.user_id));
    const activeUsers = activeUserIds.size;
    const newUsers = periodProfiles.length;
    const paidSubscriptions = filteredProfiles.filter(p => p.tier !== 'free').length;
    const newPaidSubscriptions = periodProfiles.filter(p => p.tier !== 'free').length;
    const estimatedChurn = 0; // No subscription events table
    const totalImages = filteredGenerations.length;
    const periodImages = periodGens.length;
    const creditsConsumed = periodImages; // 1 credit per image
    const creditsRemaining = filteredProfiles.reduce((s, p) => s + (p.credits || 0), 0);
    const avgImagesPerActiveUser = activeUsers > 0 ? periodImages / activeUsers : 0;

    // Top user
    const userImgCounts = new Map<string, number>();
    periodGens.forEach(g => userImgCounts.set(g.user_id, (userImgCounts.get(g.user_id) || 0) + 1));
    const topEntry = Array.from(userImgCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const topUserProfile = topEntry ? filteredProfiles.find(p => p.user_id === topEntry[0]) : null;
    const topUser = topEntry ? { name: topUserProfile?.display_name || topUserProfile?.email || 'N/A', count: topEntry[1] } : null;

    const usersWithImages = new Set(filteredGenerations.map(g => g.user_id)).size;
    const activityRate = totalUsers > 0 ? (usersWithImages / totalUsers) * 100 : 0;

    // Growth
    const calcGrowth = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
    const userGrowth = calcGrowth(periodProfiles.length, prevProfilesArr.length);
    const prevActiveUsers = new Set(prevGens.map(g => g.user_id)).size;
    const activeUserGrowth = calcGrowth(activeUsers, prevActiveUsers);
    const imageGrowth = calcGrowth(periodImages, prevGens.length);
    const newUserGrowth = calcGrowth(newUsers, prevProfilesArr.length);

    // Financial
    const grossRevenue = filteredPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const periodRevenue = periodPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const prevRevenue = prevPurchasesArr.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const revenueGrowth = calcGrowth(periodRevenue, prevRevenue);

    const periodCost = periodImages * costPerImage * 100; // in centavos
    const operationalCost = totalImages * costPerImage * 100;
    const grossProfit = periodRevenue - periodCost;
    const margin = periodRevenue > 0 ? (grossProfit / periodRevenue) * 100 : 0;

    // MRR/ARR estimation
    const planPrices: Record<string, number> = { free: 0, starter: 7900, premium: 16700, enterprise: 34700 };
    const estimatedMRR = filteredProfiles.reduce((s, p) => {
      const price = planPrices[p.tier] || 0;
      return s + (p.billing_cycle === 'annual' ? price * 0.8 : price); // 20% discount annual
    }, 0);
    const estimatedARR = estimatedMRR * 12;

    const estimatedOperationalCostUSD = totalImages * ESTIMATED_COST_PER_IMAGE_USD;
    const estimatedOperationalCostBRL = estimatedOperationalCostUSD * USD_TO_BRL_RATE;
    const totalRevenueBRL = grossRevenue / 100;
    const profitMarginBRL = totalRevenueBRL - estimatedOperationalCostBRL;
    const estimatedCreditsConsumed = Math.max(0, (5 * totalUsers + filteredPurchases.reduce((s, p) => s + (p.credits_added || 0), 0)) - creditsRemaining);

    // Activity by day
    const numDays = period === 'today' ? 1 : period === '90d' ? 90 : period === 'custom' ? Math.max(1, differenceInDays(customRange?.end || now, customRange?.start || now)) : parseInt(period);
    const activityByDay: { date: string; images: number; users: number; credits: number }[] = [];
    const dayMap = new Map<string, { images: number; users: Set<string>; credits: number }>();
    for (let i = Math.min(numDays, 365) - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(startOfDay(d), 'yyyy-MM-dd');
      dayMap.set(key, { images: 0, users: new Set(), credits: 0 });
    }
    periodGens.forEach(g => {
      const key = format(startOfDay(new Date(g.created_at)), 'yyyy-MM-dd');
      const entry = dayMap.get(key);
      if (entry) { entry.images++; entry.users.add(g.user_id); entry.credits++; }
    });
    dayMap.forEach((v, k) => activityByDay.push({ date: k, images: v.images, users: v.users.size, credits: v.credits }));

    // Revenue by day
    const revenueByDay: { date: string; revenue: number; cost: number; profit: number }[] = [];
    const revDayMap = new Map<string, { revenue: number; cost: number }>();
    dayMap.forEach((_, k) => revDayMap.set(k, { revenue: 0, cost: 0 }));
    periodPurchases.forEach(p => {
      const key = format(startOfDay(new Date(p.created_at)), 'yyyy-MM-dd');
      const entry = revDayMap.get(key);
      if (entry) entry.revenue += (p.amount_paid || 0);
    });
    activityByDay.forEach(d => {
      const entry = revDayMap.get(d.date);
      if (entry) entry.cost = d.images * costPerImage * 100;
    });
    revDayMap.forEach((v, k) => revenueByDay.push({ date: k, revenue: v.revenue / 100, cost: v.cost / 100, profit: (v.revenue - v.cost) / 100 }));

    // Plan distribution
    const tierCounts = new Map<string, number>();
    filteredProfiles.forEach(p => tierCounts.set(p.tier || 'free', (tierCounts.get(p.tier || 'free') || 0) + 1));
    const planDistribution = Array.from(tierCounts.entries()).map(([name, value]) => ({ name, value }));

    // Revenue by plan
    const revByPlan = new Map<string, number>();
    filteredPurchases.forEach(p => {
      const profile = filteredProfiles.find(pr => pr.user_id === p.user_id);
      const tier = profile?.tier || 'free';
      revByPlan.set(tier, (revByPlan.get(tier) || 0) + (p.amount_paid || 0));
    });
    const revenueByPlan = Array.from(revByPlan.entries()).map(([name, value]) => ({ name, value: value / 100 }));

    // Financial by plan table
    const allTiers = ['free', 'starter', 'premium', 'enterprise'];
    const financialByPlan = allTiers.map(plan => {
      const planProfiles = filteredProfiles.filter(p => p.tier === plan);
      const planUserIds = new Set(planProfiles.map(p => p.user_id));
      const planPeriodGens = periodGens.filter(g => planUserIds.has(g.user_id));
      const planPeriodPurchases = periodPurchases.filter(p => planUserIds.has(p.user_id));
      const planNewProfiles = periodProfiles.filter(p => p.tier === plan);
      const rev = planPeriodPurchases.reduce((s, p) => s + (p.amount_paid || 0), 0);
      const imgs = planPeriodGens.length;
      const cost = imgs * costPerImage * 100;
      const profit = rev - cost;
      return {
        plan,
        activeSubscriptions: planProfiles.length,
        newSubscriptions: planNewProfiles.length,
        cancellations: 0,
        revenue: rev,
        images: imgs,
        cost,
        profit,
        margin: rev > 0 ? (profit / rev) * 100 : 0,
      };
    });

    // Top users
    const sortedUsers = Array.from(userImgCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topUsers = sortedUsers.map(([userId, total]) => {
      const profile = filteredProfiles.find(p => p.user_id === userId);
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
    if (jobs24h.length > 0) {
      const errorRate = jobErrors24h / jobs24h.length;
      if (errorRate > 0.1) alerts.push({ type: 'error', message: `⚠️ Taxa de erros alta: ${(errorRate * 100).toFixed(0)}% dos jobs nas últimas 24h falharam` });
    }
    const avgDaily = periodImages / Math.max(1, differenceInDays(now, periodStart));
    const todayImages = filteredGenerations.filter(g => new Date(g.created_at) >= startOfDay(now)).length;
    if (todayImages > avgDaily * 2 && todayImages > 5) {
      alerts.push({ type: 'info', message: `🔥 Pico de uso: ${todayImages} imagens hoje (média: ${avgDaily.toFixed(0)}/dia)` });
    }
    const zeroCredits = filteredProfiles.filter(p => (p.credits || 0) === 0).length;
    if (zeroCredits > 0) alerts.push({ type: 'warning', message: `💳 ${zeroCredits} usuário(s) com 0 créditos` });

    return {
      profiles: filteredProfiles, generations: filteredGenerations, jobs, purchases: filteredPurchases, authUsers,
      totalUsers, activeUsers, newUsers, paidSubscriptions, newPaidSubscriptions, estimatedChurn,
      totalImages, periodImages, creditsConsumed, creditsRemaining, avgImagesPerActiveUser, topUser, activityRate,
      userGrowth, activeUserGrowth, imageGrowth, revenueGrowth, newUserGrowth,
      activityByDay, planDistribution, topUsers,
      grossRevenue, periodRevenue, operationalCost, periodCost, grossProfit, margin, estimatedMRR, estimatedARR,
      estimatedOperationalCostUSD, estimatedOperationalCostBRL, profitMarginBRL,
      revenueByDay, financialByPlan, revenueByPlan,
      totalJobs, jobErrors24h, jobSuccessRate,
      alerts, totalRevenue: grossRevenue, estimatedCreditsConsumed,
      isLoading,
    };
  }, [profiles, generations, jobs, purchases, authUsers, period, tierFilter, customRange, costPerImage, isLoading]);
}
