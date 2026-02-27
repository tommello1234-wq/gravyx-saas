import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { subDays, subMonths, startOfDay, format, differenceInDays } from 'date-fns';
import { ESTIMATED_COST_PER_IMAGE_USD, USD_TO_BRL_RATE, PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';
import type { AdminPeriod, AdminTierFilter, AdminResolutionFilter } from '../AdminContext';

const COST_PER_RESOLUTION_USD: Record<string, number> = {
  '1K': 0.067,
  '2K': 0.101,
  '4K': 0.151,
};

function getResolutionFromPayload(payload: any): string {
  if (!payload) return '1K';
  const res = typeof payload === 'object' ? payload.resolution : null;
  if (res === '2K' || res === '4K') return res;
  return '1K';
}

function getImageCountFromJob(job: any): number {
  return job.result_count && job.result_count > 0 ? job.result_count : 1;
}

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

  // Strategic metrics
  trialsActive: number;
  paidActive: number;
  trialsStartedPeriod: number;
  conversionsPeriod: number;
  conversionRate: number;
  cancelledPeriod: number;
  churnRate: number;
  arpu: number;
  avgCreditsPerPaid: number;
  avgCreditsPerTrial: number;
  zeroBalanceUsers: number;
  trialsWithNoCreditsUsed: number;
  costGrowthVsRevenue: number;

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

  // Resolution breakdown
  imagesByResolution: { '1K': number; '2K': number; '4K': number };
  imagesByResolutionByDay: { date: string; '1K': number; '2K': number; '4K': number }[];

  // Users by day (for chart)
  usersByDay: { date: string; newUsers: number; activeUsers: number }[];

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
  costPerImage: number = 0.30,
  resolutionFilter: AdminResolutionFilter = 'all'
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
          .select('id, user_id, status, error, created_at, started_at, finished_at, payload, result_count')
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
    const totalImages = filteredProfiles.reduce((s, p) => s + (p.total_generations || 0), 0);
    const periodImages = periodGens.length;
    const creditsConsumed = totalImages; // Use permanent total from profiles
    const creditsRemaining = filteredProfiles.reduce((s, p) => s + (p.credits || 0), 0);
    const avgImagesPerActiveUser = activeUsers > 0 ? periodImages / activeUsers : 0;

    // Top user
    const userImgCounts = new Map<string, number>();
    periodGens.forEach(g => userImgCounts.set(g.user_id, (userImgCounts.get(g.user_id) || 0) + 1));
    const topEntry = Array.from(userImgCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const topUserProfile = topEntry ? filteredProfiles.find(p => p.user_id === topEntry[0]) : null;
    const topUser = topEntry ? { name: topUserProfile?.display_name || topUserProfile?.email || 'N/A', count: topEntry[1] } : null;

    const usersWithImages = filteredProfiles.filter(p => (p.total_generations || 0) > 0).length;
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

    // Resolution-aware cost calculation from jobs
    const completedJobsInPeriod = jobs.filter(j => j.status === 'completed' && new Date(j.created_at) >= periodStart);
    const filteredJobsByRes = resolutionFilter === 'all'
      ? completedJobsInPeriod
      : completedJobsInPeriod.filter(j => getResolutionFromPayload(j.payload) === resolutionFilter);

    // Images by resolution
    const imagesByResolution = { '1K': 0, '2K': 0, '4K': 0 };
    completedJobsInPeriod.forEach(j => {
      const res = getResolutionFromPayload(j.payload);
      const count = getImageCountFromJob(j);
      imagesByResolution[res as keyof typeof imagesByResolution] += count;
    });


    // Resolution-aware cost calculation
    const periodCostFromJobs = completedJobsInPeriod.reduce((sum, j) => {
      const res = getResolutionFromPayload(j.payload);
      const count = getImageCountFromJob(j);
      const costUSD = COST_PER_RESOLUTION_USD[res] || COST_PER_RESOLUTION_USD['1K'];
      return sum + (count * costUSD * USD_TO_BRL_RATE * 100); // centavos BRL
    }, 0);

    const periodCost = periodCostFromJobs;
    const operationalCost = totalImages * costPerImage * 100;
    const grossProfit = periodRevenue - periodCost;
    const margin = periodRevenue > 0 ? (grossProfit / periodRevenue) * 100 : 0;

    // MRR/ARR estimation - only active paid subscribers
    const planMonthlyPrices: Record<string, number> = { free: 0, starter: 7900, premium: 16700, enterprise: 34700 };
    const planAnnualPrices: Record<string, number> = { free: 0, starter: 42000, premium: 109700, enterprise: 259700 };
    const estimatedMRR = filteredProfiles
      .filter(p => p.tier !== 'free' && p.subscription_status === 'active')
      .reduce((s, p) => {
        if (p.billing_cycle === 'annual') {
          return s + Math.round((planAnnualPrices[p.tier] || 0) / 12);
        }
        return s + (planMonthlyPrices[p.tier] || 0);
      }, 0);
    const estimatedARR = estimatedMRR * 12;

    const estimatedOperationalCostUSD = totalImages * ESTIMATED_COST_PER_IMAGE_USD;
    const estimatedOperationalCostBRL = estimatedOperationalCostUSD * USD_TO_BRL_RATE;
    const totalRevenueBRL = grossRevenue / 100;
    const profitMarginBRL = totalRevenueBRL - estimatedOperationalCostBRL;
    const estimatedCreditsConsumed = totalImages; // Use permanent total_generations sum

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

    // Images by resolution by day
    const resByDayMap = new Map<string, { '1K': number; '2K': number; '4K': number }>();
    dayMap.forEach((_, k) => resByDayMap.set(k, { '1K': 0, '2K': 0, '4K': 0 }));
    completedJobsInPeriod.forEach(j => {
      const key = format(startOfDay(new Date(j.created_at)), 'yyyy-MM-dd');
      const entry = resByDayMap.get(key);
      if (entry) {
        const res = getResolutionFromPayload(j.payload);
        const count = getImageCountFromJob(j);
        entry[res as keyof typeof entry] += count;
      }
    });
    const imagesByResolutionByDay = Array.from(resByDayMap.entries()).map(([date, v]) => ({ date, ...v }));

    // Users by day
    const newUserByDayMap = new Map<string, number>();
    const activeUserByDayMap = new Map<string, Set<string>>();
    dayMap.forEach((_, k) => { newUserByDayMap.set(k, 0); activeUserByDayMap.set(k, new Set()); });
    periodProfiles.forEach(p => {
      const key = format(startOfDay(new Date(p.created_at)), 'yyyy-MM-dd');
      if (newUserByDayMap.has(key)) newUserByDayMap.set(key, (newUserByDayMap.get(key) || 0) + 1);
    });
    periodGens.forEach(g => {
      const key = format(startOfDay(new Date(g.created_at)), 'yyyy-MM-dd');
      activeUserByDayMap.get(key)?.add(g.user_id);
    });
    const usersByDay = Array.from(newUserByDayMap.entries()).map(([date]) => ({
      date,
      newUsers: newUserByDayMap.get(date) || 0,
      activeUsers: activeUserByDayMap.get(date)?.size || 0,
    }));

    // Revenue by day
    const revenueByDay: { date: string; revenue: number; cost: number; profit: number }[] = [];
    const revDayMap = new Map<string, { revenue: number; cost: number }>();
    dayMap.forEach((_, k) => revDayMap.set(k, { revenue: 0, cost: 0 }));
    periodPurchases.forEach(p => {
      const key = format(startOfDay(new Date(p.created_at)), 'yyyy-MM-dd');
      const entry = revDayMap.get(key);
      if (entry) entry.revenue += (p.amount_paid || 0);
    });
    // Use resolution-aware costs per day
    completedJobsInPeriod.forEach(j => {
      const key = format(startOfDay(new Date(j.created_at)), 'yyyy-MM-dd');
      const entry = revDayMap.get(key);
      if (entry) {
        const res = getResolutionFromPayload(j.payload);
        const count = getImageCountFromJob(j);
        const costUSD = COST_PER_RESOLUTION_USD[res] || COST_PER_RESOLUTION_USD['1K'];
        entry.cost += count * costUSD * USD_TO_BRL_RATE * 100;
      }
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
    const topUsers = [...filteredProfiles]
      .filter(p => (p.total_generations || 0) > 0)
      .sort((a, b) => (b.total_generations || 0) - (a.total_generations || 0))
      .slice(0, 10)
      .map(profile => ({
        user_id: profile.user_id,
        email: profile.email || 'N/A',
        display_name: profile.display_name || null,
        tier: profile.tier || 'free',
        credits: profile.credits || 0,
        total_images: profile.total_generations || 0,
      }));

    // Platform performance
    const totalJobs = jobs.length;
    const last24h = subDays(now, 1);
    const jobs24h = jobs.filter(j => new Date(j.created_at) >= last24h);
    const jobErrors24h = jobs24h.filter(j => j.status === 'failed' || j.error).length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const jobSuccessRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 100;

    // Strategic metrics
    const trialsActive = filteredProfiles.filter(p => p.subscription_status === 'trial_active').length;
    const paidActive = filteredProfiles.filter(p => p.tier !== 'free' && p.subscription_status === 'active').length;
    const trialsStartedPeriod = filteredProfiles.filter(p => p.trial_start_date && new Date(p.trial_start_date) >= periodStart).length;
    const conversionsPeriod = filteredProfiles.filter(p => p.subscription_status === 'active' && p.trial_start_date && p.tier !== 'free' && new Date(p.updated_at) >= periodStart).length;
    const conversionRate = trialsStartedPeriod > 0 ? (conversionsPeriod / trialsStartedPeriod) * 100 : 0;
    const cancelledPeriod = filteredProfiles.filter(p => p.subscription_status === 'inactive' && p.tier === 'free' && p.trial_start_date && new Date(p.updated_at) >= periodStart).length;
    const churnRate = paidActive + cancelledPeriod > 0 ? (cancelledPeriod / (paidActive + cancelledPeriod)) * 100 : 0;
    const arpu = paidActive > 0 ? periodRevenue / paidActive : 0;

    // Usage metrics
    const paidUserIds = new Set(filteredProfiles.filter(p => p.tier !== 'free' && p.subscription_status === 'active').map(p => p.user_id));
    const trialUserIds = new Set(filteredProfiles.filter(p => p.subscription_status === 'trial_active').map(p => p.user_id));
    const paidPeriodImages = periodGens.filter(g => paidUserIds.has(g.user_id)).length;
    const trialPeriodImages = periodGens.filter(g => trialUserIds.has(g.user_id)).length;
    const avgCreditsPerPaid = paidActive > 0 ? paidPeriodImages / paidActive : 0;
    const avgCreditsPerTrial = trialsActive > 0 ? trialPeriodImages / trialsActive : 0;
    const zeroBalanceUsers = filteredProfiles.filter(p => (p.credits || 0) === 0).length;

    // Trials with no credits used
    const trialUsersWithImages = new Set(filteredGenerations.filter(g => trialUserIds.has(g.user_id)).map(g => g.user_id)).size;
    const trialsWithNoCreditsUsed = trialsActive > 0 ? ((trialsActive - trialUsersWithImages) / trialsActive) * 100 : 0;

    // Cost growth vs revenue
    const prevCost = prevGens.length * costPerImage * 100;
    const costGrowth = prevCost > 0 ? ((periodCost - prevCost) / prevCost) * 100 : 0;
    const costGrowthVsRevenue = costGrowth > revenueGrowth && periodCost > 0 ? 1 : 0;

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

    return {
      profiles: filteredProfiles, generations: filteredGenerations, jobs, purchases: filteredPurchases, authUsers,
      totalUsers, activeUsers, newUsers, paidSubscriptions, newPaidSubscriptions, estimatedChurn,
      totalImages, periodImages, creditsConsumed, creditsRemaining, avgImagesPerActiveUser, topUser, activityRate,
      trialsActive, paidActive, trialsStartedPeriod, conversionsPeriod, conversionRate, cancelledPeriod, churnRate, arpu,
      avgCreditsPerPaid, avgCreditsPerTrial, zeroBalanceUsers, trialsWithNoCreditsUsed, costGrowthVsRevenue,
      userGrowth, activeUserGrowth, imageGrowth, revenueGrowth, newUserGrowth,
      activityByDay, planDistribution, topUsers,
      grossRevenue, periodRevenue, operationalCost, periodCost, grossProfit, margin, estimatedMRR, estimatedARR,
      estimatedOperationalCostUSD, estimatedOperationalCostBRL, profitMarginBRL,
      revenueByDay, financialByPlan, revenueByPlan,
      imagesByResolution, imagesByResolutionByDay, usersByDay,
      totalJobs, jobErrors24h, jobSuccessRate,
      alerts, totalRevenue: grossRevenue, estimatedCreditsConsumed,
      isLoading,
    };
  }, [profiles, generations, jobs, purchases, authUsers, period, tierFilter, customRange, costPerImage, resolutionFilter, isLoading]);
}
