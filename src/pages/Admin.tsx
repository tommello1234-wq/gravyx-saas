import { useState, useRef } from 'react';
import { TemplatesTab } from '@/components/admin/TemplatesTab';
import { SubmissionsTab } from '@/components/admin/SubmissionsTab';
import { UsersTable } from '@/components/admin/dashboard/UsersTable';
import { useAdminDashboard } from '@/components/admin/dashboard/useAdminDashboard';
import { AdminProvider, useAdminContext } from '@/components/admin/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StrategicDashboard } from '@/components/admin/strategic/StrategicDashboard';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Loader2,
  Upload,
  X,
  Pencil,
  Settings2,
} from 'lucide-react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ReferenceCategory {
  id: string;
  slug: string;
  label: string;
}

interface ReferenceImage {
  id: string;
  title: string;
  prompt: string;
  category: string;
  image_url: string;
  created_at: string;
  tags: string[]; // category IDs
}

function AdminContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSection, period, tierFilter, customRange } = useAdminContext();
  
  const dashboardData = useAdminDashboard(period, tierFilter, customRange);
  
  // References state
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<ReferenceImage | null>(null);
  const [newRef, setNewRef] = useState({ title: '', prompt: '', category: '', image_url: '', selectedTags: [] as string[] });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User management state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCredits, setNewUserCredits] = useState(5);

  // Category management state
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ReferenceCategory | null>(null);
  const [newCategory, setNewCategory] = useState({ slug: '', label: '' });
  const [deleteCatDialogOpen, setDeleteCatDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ReferenceCategory | null>(null);

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['reference-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_categories')
        .select('*')
        .order('label', { ascending: true });
      if (error) throw error;
      return data as ReferenceCategory[];
    },
  });

  // Fetch references with tags
  const { data: references, isLoading: refsLoading } = useQuery({
    queryKey: ['admin-references'],
    queryFn: async () => {
      const { data: imgs, error } = await supabase
        .from('reference_images')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch tags for all images
      const { data: tagRows } = await supabase
        .from('reference_image_tags')
        .select('image_id, category_id');

      const tagsByImage = new Map<string, string[]>();
      for (const t of (tagRows || [])) {
        const arr = tagsByImage.get(t.image_id) || [];
        arr.push(t.category_id);
        tagsByImage.set(t.image_id, arr);
      }

      return imgs.map(img => ({
        ...img,
        tags: tagsByImage.get(img.id) || [],
      })) as ReferenceImage[];
    },
  });

  // CRUD mutations (same as before)
  const createRefMutation = useMutation({
    mutationFn: async (ref: typeof newRef) => {
      const { data, error } = await supabase
        .from('reference_images')
        .insert({ title: ref.title, prompt: ref.prompt, category: ref.category || ref.selectedTags[0] || '', image_url: ref.image_url, created_by: user?.id })
        .select('id')
        .single();
      if (error) throw error;
      // Insert tags
      if (ref.selectedTags.length > 0) {
        const { error: tagError } = await supabase
          .from('reference_image_tags')
          .insert(ref.selectedTags.map(catId => ({ image_id: data.id, category_id: catId })));
        if (tagError) throw tagError;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-references'] }); queryClient.invalidateQueries({ queryKey: ['library-images-with-tags'] }); closeRefDialog(); toast({ title: 'Referência criada!' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  const updateRefMutation = useMutation({
    mutationFn: async ({ id, ...ref }: { id: string; title: string; prompt: string; category: string; image_url: string; selectedTags: string[] }) => {
      const { error } = await supabase.from('reference_images').update({ title: ref.title, prompt: ref.prompt, category: ref.category || ref.selectedTags[0] || '', image_url: ref.image_url }).eq('id', id);
      if (error) throw error;
      // Replace tags: delete old, insert new
      await supabase.from('reference_image_tags').delete().eq('image_id', id);
      if (ref.selectedTags.length > 0) {
        const { error: tagError } = await supabase
          .from('reference_image_tags')
          .insert(ref.selectedTags.map(catId => ({ image_id: id, category_id: catId })));
        if (tagError) throw tagError;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-references'] }); queryClient.invalidateQueries({ queryKey: ['library-images-with-tags'] }); closeRefDialog(); toast({ title: 'Referência atualizada!' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (cat: { slug: string; label: string }) => {
      const { error } = await supabase.from('reference_categories').insert({ slug: cat.slug, label: cat.label });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reference-categories'] }); setCatDialogOpen(false); setNewCategory({ slug: '', label: '' }); setEditingCategory(null); toast({ title: 'Categoria criada!' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, slug, label }: { id: string; slug: string; label: string }) => {
      const { error } = await supabase.from('reference_categories').update({ slug, label }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reference-categories'] }); queryClient.invalidateQueries({ queryKey: ['admin-references'] }); setCatDialogOpen(false); setNewCategory({ slug: '', label: '' }); setEditingCategory(null); toast({ title: 'Categoria atualizada!' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('reference_categories').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reference-categories'] }); setDeleteCatDialogOpen(false); setCategoryToDelete(null); toast({ title: 'Categoria excluída!' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  const handleSaveCategory = () => {
    if (editingCategory) updateCategoryMutation.mutate({ id: editingCategory.id, slug: newCategory.slug, label: newCategory.label });
    else createCategoryMutation.mutate(newCategory);
  };

  const openEditCategory = (cat: ReferenceCategory) => { setEditingCategory(cat); setNewCategory({ slug: cat.slug, label: cat.label }); setCatDialogOpen(true); };
  const openNewCategory = () => { setEditingCategory(null); setNewCategory({ slug: '', label: '' }); setCatDialogOpen(true); };
  const openNewRef = () => { setEditingRef(null); setNewRef({ title: '', prompt: '', category: '', image_url: '', selectedTags: [] }); setPreviewUrl(null); setRefDialogOpen(true); };
  const openEditRef = (ref: ReferenceImage) => { setEditingRef(ref); setNewRef({ title: ref.title, prompt: ref.prompt, category: ref.category, image_url: ref.image_url, selectedTags: ref.tags }); setPreviewUrl(ref.image_url); setRefDialogOpen(true); };
  const closeRefDialog = () => { setRefDialogOpen(false); setEditingRef(null); setNewRef({ title: '', prompt: '', category: '', image_url: '', selectedTags: [] }); setPreviewUrl(null); };
  const handleSaveRef = () => { if (editingRef) updateRefMutation.mutate({ id: editingRef.id, ...newRef }); else createRefMutation.mutate(newRef); };

  const deleteRefMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('reference_images').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-references'] }); toast({ title: 'Referência excluída!' }); },
  });

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('reference-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('reference-images').getPublicUrl(fileName);
      setNewRef({ ...newRef, image_url: urlData.publicUrl });
      setPreviewUrl(urlData.publicUrl);
      toast({ title: 'Imagem enviada!' });
    } catch (error) {
      toast({ title: 'Erro no upload', description: (error as Error).message, variant: 'destructive' });
    } finally { setUploadingImage(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); };
  const clearImage = () => { setNewRef({ ...newRef, image_url: '' }); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const toggleTag = (catId: string) => {
    setNewRef(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(catId)
        ? prev.selectedTags.filter(id => id !== catId)
        : [...prev.selectedTags, catId],
    }));
  };

  const updateCreditsMutation = useMutation({
    mutationFn: async ({ userId, credits }: { userId: string; credits: number }) => {
      const { error } = await supabase.from('profiles').update({ credits }).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-dashboard-profiles'] }); toast({ title: 'Créditos atualizados!' }); },
  });


  const createUserMutation = useMutation({
    mutationFn: async ({ email, credits }: { email: string; credits: number }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('admin-users', { body: { action: 'create-user', email, credits }, headers: { Authorization: `Bearer ${sessionData.session?.access_token}` } });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-dashboard-profiles'] }); setCreateUserDialogOpen(false); setNewUserEmail(''); setNewUserCredits(5); toast({ title: 'Usuário criado!', description: 'Um email de convite foi enviado.' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('admin-users', { body: { action: 'resend-invite', userId, email }, headers: { Authorization: `Bearer ${sessionData.session?.access_token}` } });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => { toast({ title: 'Convite reenviado!' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('admin-users', { body: { action: 'delete-user', userId }, headers: { Authorization: `Bearer ${sessionData.session?.access_token}` } });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-dashboard-profiles'] }); setDeleteDialogOpen(false); setUserToDelete(null); toast({ title: 'Usuário removido!' }); },
    onError: (error) => { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); },
  });

  // Render active section
  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <StrategicDashboard />;
      case 'users':
        return (
          <>
            <AdminTopbar title="Usuários" />
            <div className="p-6">
              <UsersTable
                data={dashboardData}
                onUpdateCredits={(userId, credits) => updateCreditsMutation.mutate({ userId, credits })}
                onResendInvite={(userId, email) => resendInviteMutation.mutate({ userId, email })}
                onDeleteUser={(userId, email) => { setUserToDelete({ id: userId, email }); setDeleteDialogOpen(true); }}
                onCreateUser={() => setCreateUserDialogOpen(true)}
                isResending={resendInviteMutation.isPending}
              />
            </div>
          </>
        );
      case 'library':
        return (
          <>
            <AdminTopbar title="Biblioteca" />
            <div className="p-6 space-y-6">
              {/* Categories */}
              <Card className="glass-card">
                <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                        <Settings2 className="h-5 w-5" />
                        <CardTitle className="text-lg">Gerenciar Categorias</CardTitle>
                        <Badge variant="secondary" className="ml-2">{categories.length}</Badge>
                      </Button>
                    </CollapsibleTrigger>
                    <Button size="sm" className="rounded-full" onClick={openNewCategory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova
                    </Button>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {categoriesLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <div key={cat.id} className="flex items-center gap-1 bg-secondary/50 rounded-full pl-3 pr-1 py-1">
                              <span className="text-sm">{cat.label}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => openEditCategory(cat)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-destructive hover:text-destructive" onClick={() => { setCategoryToDelete(cat); setDeleteCatDialogOpen(true); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Community Submissions */}
              <SubmissionsTab />

              {/* Reference Images */}
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Imagens de Referência</CardTitle>
                  <Button size="sm" className="rounded-full" onClick={openNewRef}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  {refsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Imagem</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead className="max-w-[200px]">Prompt</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {references?.map((ref) => (
                          <TableRow key={ref.id}>
                            <TableCell>
                              <img src={ref.image_url} alt={ref.title} className="w-14 h-14 object-cover rounded-lg border border-border" />
                            </TableCell>
                            <TableCell className="font-medium">{ref.title}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {ref.tags.map(catId => {
                                  const cat = categories.find(c => c.id === catId);
                                  return cat ? <Badge key={catId} variant="secondary">{cat.label}</Badge> : null;
                                })}
                                {ref.tags.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{ref.prompt}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRef(ref)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRefMutation.mutate(ref.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        );
      case 'templates':
        return (
          <>
            <AdminTopbar title="Templates" />
            <div className="p-6">
              <TemplatesTab />
            </div>
          </>
        );
      case 'settings':
        return (
          <>
            <AdminTopbar title="Configurações" />
            <div className="p-6">
              <Card className="glass-card max-w-lg">
                <CardHeader><CardTitle>Configurações Gerais</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">As configurações de custo por imagem estão disponíveis no Dashboard Financeiro.</p>
                </CardContent>
              </Card>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      {renderContent()}

      {/* Reference Dialog */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRef ? 'Editar Referência' : 'Nova Referência'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={newRef.title} onChange={(e) => setNewRef({ ...newRef, title: e.target.value })} /></div>
            <div><Label>Prompt</Label><Textarea value={newRef.prompt} onChange={(e) => setNewRef({ ...newRef, prompt: e.target.value })} /></div>
            <div>
              <Label>Tags / Categorias</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant={newRef.selectedTags.includes(cat.id) ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleTag(cat.id)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Imagem</Label>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              {previewUrl ? (
                <div className="relative mt-2">
                  <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                  <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={clearImage}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <Upload className={`h-8 w-8 mx-auto text-muted-foreground mb-2 ${uploadingImage ? 'animate-pulse' : ''}`} />
                  <p className="text-sm text-muted-foreground">{uploadingImage ? 'Enviando...' : 'Clique para upload'}</p>
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveRef} disabled={createRefMutation.isPending || updateRefMutation.isPending || !newRef.image_url}>
              {(createRefMutation.isPending || updateRefMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRef ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Slug</Label>
              <Input value={newCategory.slug} onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="ex: paisagem-urbana" disabled={!!editingCategory} />
            </div>
            <div><Label>Nome</Label><Input value={newCategory.label} onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })} placeholder="ex: Paisagem Urbana" /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCategory} disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending || !newCategory.slug || !newCategory.label}>
              {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Email</Label><Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
            <div><Label>Créditos iniciais</Label><Input type="number" value={newUserCredits} onChange={(e) => setNewUserCredits(parseInt(e.target.value) || 0)} min={0} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => createUserMutation.mutate({ email: newUserEmail, credits: newUserCredits })} disabled={createUserMutation.isPending || !newUserEmail}>
              {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar e Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category */}
      <AlertDialog open={deleteCatDialogOpen} onOpenChange={setDeleteCatDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir <strong>{categoryToDelete?.label}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (categoryToDelete) deleteCategoryMutation.mutate(categoryToDelete.id); }} disabled={deleteCategoryMutation.isPending}>
              {deleteCategoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso do usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente o acesso de <strong>{userToDelete?.email}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (userToDelete) deleteUserMutation.mutate({ userId: userToDelete.id }); }} disabled={deleteUserMutation.isPending}>
              {deleteUserMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

export default function Admin() {
  return (
    <AdminProvider>
      <AdminContent />
    </AdminProvider>
  );
}
