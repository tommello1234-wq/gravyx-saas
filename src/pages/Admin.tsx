import { useState, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { TemplatesTab } from '@/components/admin/TemplatesTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Loader2,
  Images,
  LayoutTemplate,
  Users,
  Coins,
  Upload,
  X,
  Send,
  MoreHorizontal,
  Pencil,
  UserPlus,
  Settings2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
}

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // References state
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<ReferenceImage | null>(null);
  const [newRef, setNewRef] = useState({ title: '', prompt: '', category: '', image_url: '' });
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

  // Fetch references
  const { data: references, isLoading: refsLoading } = useQuery({
    queryKey: ['admin-references'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_images')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ReferenceImage[];
    },
  });

  // Fetch profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create reference mutation
  const createRefMutation = useMutation({
    mutationFn: async (ref: typeof newRef) => {
      const { error } = await supabase
        .from('reference_images')
        .insert({ 
          title: ref.title, 
          prompt: ref.prompt, 
          category: ref.category,
          image_url: ref.image_url,
          created_by: user?.id 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-references'] });
      closeRefDialog();
      toast({ title: 'Referência criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Update reference mutation
  const updateRefMutation = useMutation({
    mutationFn: async ({ id, ...ref }: { id: string; title: string; prompt: string; category: string; image_url: string }) => {
      const { error } = await supabase
        .from('reference_images')
        .update({ title: ref.title, prompt: ref.prompt, category: ref.category, image_url: ref.image_url })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-references'] });
      closeRefDialog();
      toast({ title: 'Referência atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Category CRUD mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (cat: { slug: string; label: string }) => {
      const { error } = await supabase
        .from('reference_categories')
        .insert({ slug: cat.slug, label: cat.label });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-categories'] });
      setCatDialogOpen(false);
      setNewCategory({ slug: '', label: '' });
      setEditingCategory(null);
      toast({ title: 'Categoria criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, slug, label }: { id: string; slug: string; label: string }) => {
      const { error } = await supabase
        .from('reference_categories')
        .update({ slug, label })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-references'] });
      setCatDialogOpen(false);
      setNewCategory({ slug: '', label: '' });
      setEditingCategory(null);
      toast({ title: 'Categoria atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-categories'] });
      setDeleteCatDialogOpen(false);
      setCategoryToDelete(null);
      toast({ title: 'Categoria excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleSaveCategory = () => {
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        slug: newCategory.slug,
        label: newCategory.label,
      });
    } else {
      createCategoryMutation.mutate(newCategory);
    }
  };

  const openEditCategory = (cat: ReferenceCategory) => {
    setEditingCategory(cat);
    setNewCategory({ slug: cat.slug, label: cat.label });
    setCatDialogOpen(true);
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setNewCategory({ slug: '', label: '' });
    setCatDialogOpen(true);
  };

  // Reference dialog helpers
  const openNewRef = () => {
    setEditingRef(null);
    setNewRef({ title: '', prompt: '', category: '', image_url: '' });
    setPreviewUrl(null);
    setRefDialogOpen(true);
  };

  const openEditRef = (ref: ReferenceImage) => {
    setEditingRef(ref);
    setNewRef({ title: ref.title, prompt: ref.prompt, category: ref.category, image_url: ref.image_url });
    setPreviewUrl(ref.image_url);
    setRefDialogOpen(true);
  };

  const closeRefDialog = () => {
    setRefDialogOpen(false);
    setEditingRef(null);
    setNewRef({ title: '', prompt: '', category: '', image_url: '' });
    setPreviewUrl(null);
  };

  const handleSaveRef = () => {
    if (editingRef) {
      updateRefMutation.mutate({ id: editingRef.id, ...newRef });
    } else {
      createRefMutation.mutate(newRef);
    }
  };

  // Delete reference mutation
  const deleteRefMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_images').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-references'] });
      toast({ title: 'Referência excluída!' });
    },
  });

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reference-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('reference-images')
        .getPublicUrl(fileName);

      setNewRef({ ...newRef, image_url: urlData.publicUrl });
      setPreviewUrl(urlData.publicUrl);
      toast({ title: 'Imagem enviada!' });
    } catch (error) {
      console.error('Upload error:', error);
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
    if (file) {
      handleImageUpload(file);
    }
  };

  const clearImage = () => {
    setNewRef({ ...newRef, image_url: '' });
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Update credits mutation
  const updateCreditsMutation = useMutation({
    mutationFn: async ({ userId, credits }: { userId: string; credits: number }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ credits })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      toast({ title: 'Créditos atualizados!' });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async ({ email, credits }: { email: string; credits: number }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'create-user', email, credits },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      setCreateUserDialogOpen(false);
      setNewUserEmail('');
      setNewUserCredits(5);
      toast({ title: 'Usuário criado!', description: 'Um email de convite foi enviado.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Resend invite mutation
  const resendInviteMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'resend-invite', userId, email },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Convite reenviado!', description: 'O usuário receberá um email de acesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete-user', userId },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      toast({ title: 'Usuário removido!', description: 'O acesso foi revogado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Painel Admin</h1>
          <p className="text-muted-foreground">
            Gerencie biblioteca, templates e usuários
          </p>
        </div>

        <Tabs defaultValue="references" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="references" className="gap-2">
              <Images className="h-4 w-4" />
              Biblioteca
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          </TabsList>

          {/* References Tab */}
          <TabsContent value="references">
            <div className="space-y-6">
              {/* Categories Management Collapsible */}
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
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <div
                              key={cat.id}
                              className="flex items-center gap-1 bg-secondary/50 rounded-full pl-3 pr-1 py-1"
                            >
                              <span className="text-sm">{cat.label}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full"
                                onClick={() => openEditCategory(cat)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full text-destructive hover:text-destructive"
                                onClick={() => {
                                  setCategoryToDelete(cat);
                                  setDeleteCatDialogOpen(true);
                                }}
                              >
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
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Imagem</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="max-w-[200px]">Prompt</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {references?.map((ref) => (
                          <TableRow key={ref.id}>
                            <TableCell>
                              <img
                                src={ref.image_url}
                                alt={ref.title}
                                className="w-14 h-14 object-cover rounded-lg border border-border"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{ref.title}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {categories.find((c) => c.slug === ref.category)?.label || ref.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                              {ref.prompt}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditRef(ref)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => deleteRefMutation.mutate(ref.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Usuários</CardTitle>
                <Button size="sm" className="rounded-full" onClick={() => setCreateUserDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Usuário
                </Button>
              </CardHeader>
              <CardContent>
                {profilesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead className="w-[150px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles?.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>{profile.email}</TableCell>
                          <TableCell className="capitalize">{profile.tier}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Coins className="h-4 w-4 text-primary" />
                              {profile.credits}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-20 h-8"
                                defaultValue={profile.credits}
                                onBlur={(e) => {
                                  const newCredits = parseInt(e.target.value);
                                  if (newCredits !== profile.credits) {
                                    updateCreditsMutation.mutate({
                                      userId: profile.user_id,
                                      credits: newCredits,
                                    });
                                  }
                                }}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => resendInviteMutation.mutate({ 
                                      userId: profile.user_id, 
                                      email: profile.email 
                                    })}
                                    disabled={resendInviteMutation.isPending}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Reenviar acesso
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      setUserToDelete({ id: profile.user_id, email: profile.email });
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remover acesso
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Reference Dialog (Create/Edit) */}
      <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRef ? 'Editar Referência' : 'Nova Referência'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={newRef.title}
                onChange={(e) => setNewRef({ ...newRef, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Prompt</Label>
              <Textarea
                value={newRef.prompt}
                onChange={(e) => setNewRef({ ...newRef, prompt: e.target.value })}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={newRef.category}
                onValueChange={(v) => setNewRef({ ...newRef, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Imagem</Label>
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
                    className="w-full h-40 object-cover rounded-lg"
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
                  className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
                >
                  <Upload className={`h-8 w-8 mx-auto text-muted-foreground mb-2 ${uploadingImage ? 'animate-pulse' : ''}`} />
                  <p className="text-sm text-muted-foreground">
                    {uploadingImage ? 'Enviando...' : 'Clique para upload'}
                  </p>
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveRef}
              disabled={createRefMutation.isPending || updateRefMutation.isPending || !newRef.image_url}
            >
              {(createRefMutation.isPending || updateRefMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRef ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Slug (identificador único)</Label>
              <Input
                value={newCategory.slug}
                onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="ex: paisagem-urbana"
                disabled={!!editingCategory}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado internamente para identificar a categoria
              </p>
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={newCategory.label}
                onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                placeholder="ex: Paisagem Urbana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveCategory}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending || !newCategory.slug || !newCategory.label}
            >
              {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Créditos iniciais</Label>
              <Input
                type="number"
                value={newUserCredits}
                onChange={(e) => setNewUserCredits(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createUserMutation.mutate({ email: newUserEmail, credits: newUserCredits })}
              disabled={createUserMutation.isPending || !newUserEmail}
            >
              {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar e Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={deleteCatDialogOpen} onOpenChange={setDeleteCatDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria{' '}
              <strong>{categoryToDelete?.label}</strong>? 
              Imagens existentes com esta categoria não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (categoryToDelete) {
                  deleteCategoryMutation.mutate(categoryToDelete.id);
                }
              }}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso do usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente o acesso de{' '}
              <strong>{userToDelete?.email}</strong> à plataforma. 
              Todos os dados do usuário serão excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (userToDelete) {
                  deleteUserMutation.mutate({ userId: userToDelete.id });
                }
              }}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
