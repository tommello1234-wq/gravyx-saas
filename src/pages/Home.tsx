import { useState } from 'react';
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
import { getTierConfig } from '@/lib/plan-limits';
import { useToast } from '@/hooks/use-toast';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  const tier = profile?.tier ?? 'free';
  const tierConfig = getTierConfig(tier);
  const isFree = tier === 'free';

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
          (t: any) => t.reference_categories?.slug
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

  // Create project mutation (reused from Projects page)
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
      toast({ title: 'Erro ao criar projeto', description: error.message, variant: 'destructive' });
    },
  });

  const handleNewProject = () => {
    const currentCount = stats?.projects ?? 0;
    if (!isAdmin && tierConfig.maxProjects !== -1 && currentCount >= tierConfig.maxProjects) {
      toast({
        title: 'Limite de projetos atingido',
        description: `Seu plano ${tierConfig.label} permite até ${tierConfig.maxProjects} projeto(s). Faça upgrade para criar mais.`,
        variant: 'destructive',
      });
      return;
    }
    setCreateOpen(true);
  };

  const showUpgrade = tier === 'free' || tier === 'starter';
  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 space-y-12">
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
                {getGreeting()}, <span className="gradient-text">{displayName}</span> 👋
              </h1>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Badge variant="outline" className="gap-1.5">
                  <Crown className="h-3 w-3" />
                  {tierLabels[tier] ?? tier}
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <Coins className="h-3 w-3" />
                  {profile?.credits ?? 0} créditos
                </Badge>
              </div>
            </div>

            <Button
              size="lg"
              className="rounded-full glow-primary gap-2 text-base shrink-0"
              onClick={handleNewProject}
            >
              <Plus className="h-5 w-5" />
              Criar novo projeto
            </Button>
          </div>
        </motion.section>

        {/* ===== RECENT GENERATIONS ===== */}
        <motion.section key={`recent-${recentImages?.length ?? 'loading'}`} variants={stagger} initial="hidden" animate="show">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Suas criações recentes
            </h2>
            {recentImages && recentImages.length > 0 && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/gallery')}>
                Ver tudo <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!recentImages || recentImages.length === 0 ? (
            <motion.div variants={fadeUp} className="glass-card p-10 text-center">
              <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">Você ainda não gerou nenhuma imagem.</p>
              <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-2">
                <Plus className="h-4 w-4" /> Criar primeiro projeto
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
                Comece algo novo
              </h2>
            </div>

            <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <motion.div key={t.id} variants={fadeUp}>
                  <Card className="glass-card overflow-hidden hover:border-primary/50 transition-all group">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {t.thumbnail_url ? (
                        <img
                          src={t.thumbnail_url}
                          alt={t.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-sm truncate mb-1">{t.name}</h3>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1"
                        onClick={() => {
                          // Open create modal — user can type name then
                          setCreateOpen(true);
                        }}
                      >
                        Usar template
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
                Biblioteca em destaque
              </h2>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/library')}>
                Explorar biblioteca <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {libraryImages.map((img: any) => {
                const locked = isFree && !img.tags.includes('free');
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

            {isFree && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                🔒 Desbloqueie a biblioteca completa no plano Starter.
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
            { label: 'Projetos criados', value: stats?.projects ?? 0, icon: LayoutGrid },
            { label: 'Imagens geradas', value: stats?.generations ?? 0, icon: Image },
            { label: 'Créditos restantes', value: profile?.credits ?? 0, icon: Coins },
            { label: 'Plano atual', value: tierLabels[tier] ?? tier, icon: Crown },
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
                    Desbloqueie todo o potencial da Gravyx
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Projetos ilimitados, mais créditos e acesso completo à biblioteca com o plano Premium.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="rounded-full glow-primary gap-2 shrink-0"
                  onClick={() => setShowBuyCredits(true)}
                >
                  <Zap className="h-4 w-4" />
                  Ver planos
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
      />
      <BuyCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />
    </div>
  );
}
