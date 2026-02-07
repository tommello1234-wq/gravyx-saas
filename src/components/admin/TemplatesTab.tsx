import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Trash2, 
  Loader2,
  Upload,
  X,
  LayoutTemplate,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Template {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  canvas_state: unknown;
  created_at: string;
  created_by: string | null;
}

interface Project {
  id: string;
  name: string;
  canvas_state: unknown;
}

export function TemplatesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    thumbnail_url: '',
  });

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  // Fetch admin's projects (to import canvas)
  const { data: adminProjects } = useQuery({
    queryKey: ['admin-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, canvas_state')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      // Get canvas_state from selected project
      let canvasState = { nodes: [], edges: [] };
      if (selectedProjectId && adminProjects) {
        const project = adminProjects.find(p => p.id === selectedProjectId);
        if (project?.canvas_state) {
          canvasState = project.canvas_state as { nodes: [], edges: [] };
        }
      }

      const { error } = await supabase
        .from('project_templates')
        .insert({
          name: newTemplate.name,
          description: newTemplate.description || null,
          thumbnail_url: newTemplate.thumbnail_url || null,
          canvas_state: canvasState,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Template criado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      toast({ title: 'Template excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setNewTemplate({ name: '', description: '', thumbnail_url: '' });
    setPreviewUrl(null);
    setSelectedProjectId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/templates/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reference-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('reference-images')
        .getPublicUrl(fileName);

      setNewTemplate({ ...newTemplate, thumbnail_url: urlData.publicUrl });
      setPreviewUrl(urlData.publicUrl);
      toast({ title: 'Imagem enviada!' });
    } catch (error) {
      toast({
        title: 'Erro no upload',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const clearImage = () => {
    setNewTemplate({ ...newTemplate, thumbnail_url: '' });
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Templates de Projeto</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Criar Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Novo Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Ex: Template para Produtos"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Descreva o uso do template..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Thumbnail</Label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  {previewUrl ? (
                    <div className="relative mt-2">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={clearImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors"
                    >
                      <Upload className={`h-6 w-6 mx-auto text-muted-foreground mb-1 ${uploadingImage ? 'animate-pulse' : ''}`} />
                      <p className="text-sm text-muted-foreground">
                        {uploadingImage ? 'Enviando...' : 'Clique para upload'}
                      </p>
                    </button>
                  )}
                </div>
                <div>
                  <Label>Importar canvas de um projeto</Label>
                  <Select
                    value={selectedProjectId || 'none'}
                    onValueChange={(v) => setSelectedProjectId(v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (canvas vazio)</SelectItem>
                      {adminProjects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    O canvas do projeto selecionado será copiado para o template
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !newTemplate.name.trim()}
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="overflow-hidden group">
                  <div className="aspect-video bg-muted relative">
                    {template.thumbnail_url ? (
                      <img
                        src={template.thumbnail_url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <LayoutTemplate className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(template.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={() => {
                          setTemplateToDelete(template);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <LayoutTemplate className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhum template ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie templates para os usuários usarem como base
              </p>
              <Button onClick={() => setDialogOpen(true)} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro template
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{templateToDelete?.name}" será excluído permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (templateToDelete) {
                  deleteMutation.mutate(templateToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
