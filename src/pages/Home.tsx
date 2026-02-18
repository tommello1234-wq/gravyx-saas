import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';
import { WelcomeVideoModal } from '@/components/WelcomeVideoModal';
import { getTierConfig } from '@/lib/plan-limits';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ArrowRight,
  FolderOpen,
  Image,
  Coins,
  Crown,
  Lock,
  Sparkles,
  LayoutGrid,
  Calendar,
  Zap,
  Rocket,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS, es as esLocale } from 'date-fns/locale';

const tierLabels: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

interface CanvasNode {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface CanvasState {
  nodes: CanvasNode[];
  edges: unknown[];
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Home() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding modal for first-time users
  useEffect(() => {
    if (profile && profile.has_seen_onboarding === false) {
      setShowOnboarding(true);
    }
  }, [profile]);

  const tier = profile?.tier ?? 'free';
  const tierConfig = getTierConfig(tier);
  const isFree = tier === 'free' && !isAdmin;
  const subscriptionStatus = (profile as any)?.subscription_status ?? 'inactive';
  const isTrialActive = subscriptionStatus === 'trial_active';
  const isInactive = subscriptionStatus === 'inactive' || subscriptionStatus === 'cancelled';
  const trialDaysRemaining = isTrialActive && (profile as any)?.trial_start_date
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date((profile as any).trial_start_date).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Recent generations
  const { data: recentImages } = useQuery({
    queryKey: ['home-recent-generations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('id, prompt, image_url, created_at')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Templates
  const { data: templates } = useQuery({
    queryKey: ['home-templates', tier],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_templates')
        .select('id, name, description, thumbnail_url')
        .contains('allowed_tiers', [tier])
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Library highlights
  const { data: libraryImages } = useQuery({
    queryKey: ['home-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_images')
        .select(`
          id, title, image_url, prompt,
          reference_image_tags(
            category_id,
            reference_categories(slug)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []).map((img: any) => ({
        ...img,
        tags: (img.reference_image_tags ?? []).map(
          (tag: any) => tag.reference_categories?.slug
        ).filter(Boolean),
      }));
    },
    enabled: !!user,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['home-stats', user?.id],
    queryFn: async () => {
      const [projectsRes, generationsRes] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('generations').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'completed'),
      ]);
      return {
        projects: projectsRes.count ?? 0,
        generations: generationsRes.count ?? 0,
      };
    },
    enabled: !!user,
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async ({ name, templateId }: { name: string; templateId?: string }) => {
      let canvasState: CanvasState = { nodes: [], edges: [] };
      if (templateId) {
        const { data: template } = await supabase
          .from('project_templates')
          .select('canvas_state')
          .eq('id', templateId)
          .single();
        if (template?.canvas_state) {
          const ts = template.canvas_state as unknown as CanvasState;
          const idMap: Record<string, string> = {};
          const newNodes = ts.nodes?.map((node: CanvasNode) => {
            const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            idMap[node.id] = newId;
            return { ...node, id: newId };
          }) || [];
          const newEdges = (ts.edges || []).map((edge: any) => ({
            ...edge,
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: idMap[edge.source] || edge.source,
            target: idMap[edge.target] || edge.target,
          }));
          canvasState = { nodes: newNodes, edges: newEdges };
        }
      }
      const { data, error } = await supabase
        .from('projects')
        .insert([{ name, user_id: user?.id, canvas_state: canvasState }] as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      navigate(`/app?project=${data.id}`);
    },
    onError: (error) => {
      toast({ title: t('home.error_create_project'), description: error.message, variant: 'destructive' });
    },
  });

  const handleNewProject = () => {
    const currentCount = stats?.projects ?? 0;
    if (!isAdmin && tierConfig.maxProjects !== -1 && currentCount >= tierConfig.maxProjects) {
      toast({
        title: t('home.project_limit_reached'),
        description: t('home.project_limit_desc').replace('{plan}', tierConfig.label).replace('{max}', String(tierConfig.maxProjects)),
        variant: 'destructive',
      });
      return;
    }
    setCreateOpen(true);
  };

  const showUpgrade = !isAdmin && (tier === 'free' || tier === 'starter');
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || t('common.user');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('home.good_morning');
    if (h < 18) return t('home.good_afternoon');
    return t('home.good_evening');
  })();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 space-y-12">
        {/* ===== TRIAL / INACTIVE BANNER ===== */}
        {!isAdmin && isTrialActive && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t('home.trial_active')} — {trialDaysRemaining} {trialDaysRemaining === 1 ? t('home.day_remaining') : t('home.days_remaining')}</p>
              <p className="text-xs text-muted-foreground">{t('home.trial_credits_info')} {profile?.credits ?? 0}</p>
            </div>
          </motion.div>
        )}

        {!isAdmin && isInactive && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t('home.no_subscription')}</p>
              <p className="text-xs text-muted-foreground">{t('home.subscribe_info')}</p>
            </div>
            <Button size="sm" className="rounded-full gap-1.5 shrink-0" onClick={() => setShowBuyCredits(true)}>
              <Zap className="h-3.5 w-3.5" />
              {t('home.see_plans')}
            </Button>
          </motion.div>
        )}
        {/* ===== HERO ===== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl glass-card p-8 md:p-12"
        >
          <div className="orb w-72 h-72 bg-primary/20 -top-36 -right-36" />
          <div className="orb w-56 h-56 bg-secondary/20 -bottom-28 -left-28" style={{ animationDelay: '3s' }} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {greeting}, <span className="gradient-text">{displayName}</span> 👋
              </h1>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Badge variant="outline" className="gap-1.5">
                  <Crown className="h-3 w-3" />
                  {isAdmin ? 'Admin' : (tierLabels[tier] ?? tier)}
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <Coins className="h-3 w-3" />
                  {profile?.credits ?? 0} {t('header.credits')}
                </Badge>
              </div>
            </div>

            <Button
              size="lg"
              className="rounded-full glow-primary gap-2 text-base shrink-0"
              onClick={handleNewProject}
            >
              <Plus className="h-5 w-5" />
              {t('home.create_new_project')}
            </Button>
          </div>
        </motion.section>

        {/* ===== RECENT GENERATIONS ===== */}
        <motion.section key={`recent-${recentImages?.length ?? 'loading'}`} variants={stagger} initial="hidden" animate="show">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              {t('home.recent_creations')}
            </h2>
            {recentImages && recentImages.length > 0 && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/gallery')}>
                {t('home.view_all')} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!recentImages || recentImages.length === 0 ? (
            <motion.div variants={fadeUp} className="glass-card p-10 text-center">
              <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">{t('home.no_images_yet')}</p>
              <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-2">
                <Plus className="h-4 w-4" /> {t('home.create_first_project')}
              </Button>
            </motion.div>
          ) : (
            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {recentImages.map((img) => (
                <motion.div key={img.id} variants={fadeUp} className="group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border cursor-pointer"
                       onClick={() => navigate('/gallery')}>
                    <img
                      src={img.image_url!}
                      alt={img.prompt}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.section>

        {/* ===== TEMPLATES ===== */}
        {templates && templates.length > 0 && (
          <motion.section variants={stagger} initial="hidden" animate="show">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t('home.start_something_new')}
              </h2>
            </div>

            <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tmpl) => (
                <motion.div key={tmpl.id} variants={fadeUp}>
                  <Card className="glass-card overflow-hidden hover:border-primary/50 transition-all group">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {tmpl.thumbnail_url ? (
                        <img
                          src={tmpl.thumbnail_url}
                          alt={tmpl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-sm truncate mb-1">{tmpl.name}</h3>
                      {tmpl.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tmpl.description}</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1"
                        onClick={() => {
                          setCreateOpen(true);
                        }}
                      >
                        {t('home.use_template')}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        )}

        {/* ===== LIBRARY HIGHLIGHTS ===== */}
        {libraryImages && libraryImages.length > 0 && (
          <motion.section variants={stagger} initial="hidden" animate="show">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                {t('home.library_highlights')}
              </h2>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/library')}>
                {t('home.explore_library')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {libraryImages.map((img: any) => {
                const locked = !isAdmin && isFree && !img.tags.includes('free');
                return (
                  <motion.div key={img.id} variants={fadeUp} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                      <img
                        src={img.image_url}
                        alt={img.title}
                        className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${locked ? 'blur-sm' : ''}`}
                      />
                      {locked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {!isAdmin && isFree && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {t('home.unlock_library')}
              </p>
            )}
          </motion.section>
        )}

        {/* ===== STATS ===== */}
        <motion.section
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: t('home.projects_created'), value: stats?.projects ?? 0, icon: LayoutGrid },
            { label: t('home.images_generated'), value: stats?.generations ?? 0, icon: Image },
            { label: t('home.remaining_credits'), value: profile?.credits ?? 0, icon: Coins },
            { label: t('home.current_plan'), value: tierLabels[tier] ?? tier, icon: Crown },
          ].map((s, i) => (
            <motion.div key={i} variants={fadeUp}>
              <Card className="glass-card">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.section>

        {/* ===== UPGRADE CTA ===== */}
        {showUpgrade && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="relative overflow-hidden gradient-border">
              <div className="orb w-64 h-64 bg-primary/15 -top-32 -right-32" />
              <CardContent className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row items-center gap-6">
                <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                  <Rocket className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-semibold mb-1">
                    {t('home.unlock_potential')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('home.unlimited_projects')}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="rounded-full glow-primary gap-2 shrink-0"
                  onClick={() => setShowBuyCredits(true)}
                >
                  <Zap className="h-4 w-4" />
                  {t('home.see_plans')}
                </Button>
              </CardContent>
            </Card>
          </motion.section>
        )}
      </main>

      <CreateProjectModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreateFromScratch={(name) => createMutation.mutate({ name })}
        onCreateFromTemplate={(name, templateId) => createMutation.mutate({ name, templateId })}
        isCreating={createMutation.isPending}
        userTier={tier}
        isAdmin={isAdmin}
      />
      <BuyCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />
      <WelcomeVideoModal open={showOnboarding} onOpenChange={setShowOnboarding} />
    </div>
  );
}
