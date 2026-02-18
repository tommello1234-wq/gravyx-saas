import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Loader2,
  FolderOpen,
  Calendar
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR, enUS, es as esLocale } from 'date-fns/locale';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { getTierConfig } from '@/lib/plan-limits';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface CanvasNode {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface CanvasState {
  nodes: CanvasNode[];
  edges: unknown[];
}

const dateLocales = { pt: ptBR, en: enUS, es: esLocale };
const dateFormats = {
  pt: "d 'de' MMM",
  en: "MMM d",
  es: "d 'de' MMM",
};

export default function Projects() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');

  const tierConfig = getTierConfig(profile?.tier ?? 'free');

  const handleNewProject = () => {
    const currentCount = projects?.length ?? 0;
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

  // Fetch projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, created_at, updated_at')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Project[];
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
          const templateState = template.canvas_state as unknown as CanvasState;
          const idMapping: Record<string, string> = {};
          const newNodes = templateState.nodes?.map((node: CanvasNode) => {
            const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            idMapping[node.id] = newId;
            return { ...node, id: newId };
          }) || [];
          const newEdges = (templateState.edges || []).map((edge: { id?: string; source: string; target: string; [key: string]: unknown }) => ({
            ...edge,
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: idMapping[edge.source] || edge.source,
            target: idMapping[edge.target] || edge.target
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
      toast({
        title: t('home.error_create_project'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateFromScratch = (name: string) => {
    createMutation.mutate({ name });
  };

  const handleCreateFromTemplate = (name: string, templateId: string) => {
    createMutation.mutate({ name, templateId });
  };

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('projects')
        .update({ name })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(null);
      toast({ title: t('projects.project_renamed') });
    },
    onError: (error) => {
      toast({
        title: t('projects.error_rename'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: t('projects.project_deleted') });
    },
    onError: (error) => {
      toast({
        title: t('projects.error_delete'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = () => {
    if (!editingProject || !editName.trim()) return;
    updateMutation.mutate({ id: editingProject.id, name: editName });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('projects.my_projects')}</h1>
            <p className="text-muted-foreground">
              {t('projects.manage')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user && profile && (
              <Badge variant="outline" className="text-xs">
                {projects?.length ?? 0}/{tierConfig.maxProjects === -1 ? '∞' : tierConfig.maxProjects} {t('projects.projects_count')}
              </Badge>
            )}
            <Button 
              className="rounded-full glow-primary"
              onClick={handleNewProject}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('projects.new_project')}
            </Button>
          </div>

          <CreateProjectModal
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreateFromScratch={handleCreateFromScratch}
            onCreateFromTemplate={handleCreateFromTemplate}
            isCreating={createMutation.isPending}
            userTier={profile?.tier ?? 'free'}
            isAdmin={isAdmin}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-12 text-center"
          >
            <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t('projects.no_projects')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('projects.create_first')}
            </p>
            <Button onClick={() => setCreateOpen(true)} className="rounded-full">
              <Plus className="mr-2 h-4 w-4" />
              {t('home.create_first_project')}
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="glass-card hover:border-primary/50 transition-all cursor-pointer group"
                  onClick={() => navigate(`/app?project=${project.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-semibold truncate pr-4 group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setEditName(project.name);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('projects.rename')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(project.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('projects.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {t('projects.updated')} {format(new Date(project.updated_at), dateFormats[language], { locale: dateLocales[language] })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>{t('projects.rename_project')}</DialogTitle>
            </DialogHeader>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProject(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
