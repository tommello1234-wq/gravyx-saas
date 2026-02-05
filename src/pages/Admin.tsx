import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Coins
} from 'lucide-react';

const categories = [
  { value: 'photography', label: 'Fotografia' },
  { value: 'creative', label: 'Criativo' },
  { value: 'food', label: 'Comida' },
  { value: 'product', label: 'Produto' },
  { value: 'portrait', label: 'Retrato' },
  { value: 'landscape', label: 'Paisagem' },
  { value: 'abstract', label: 'Abstrato' },
];

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // References state
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [newRef, setNewRef] = useState({ title: '', prompt: '', category: 'photography', image_url: '' });

  // Fetch references
  const { data: references, isLoading: refsLoading } = useQuery({
    queryKey: ['admin-references'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_images')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
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
          category: ref.category as 'photography' | 'creative' | 'food' | 'product' | 'portrait' | 'landscape' | 'abstract',
          image_url: ref.image_url,
          created_by: user?.id 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-references'] });
      setRefDialogOpen(false);
      setNewRef({ title: '', prompt: '', category: 'photography', image_url: '' });
      toast({ title: 'Referência criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Painel Admin</h1>
          <p className="text-muted-foreground">
            Gerencie referências, templates e usuários
          </p>
        </div>

        <Tabs defaultValue="references" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="references" className="gap-2">
              <Images className="h-4 w-4" />
              Referências
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
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Imagens de Referência</CardTitle>
                <Dialog open={refDialogOpen} onOpenChange={setRefDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Referência</DialogTitle>
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
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>URL da Imagem</Label>
                        <Input
                          value={newRef.image_url}
                          onChange={(e) => setNewRef({ ...newRef, image_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createRefMutation.mutate(newRef)}
                        disabled={createRefMutation.isPending}
                      >
                        {createRefMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                        <TableHead>Título</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {references?.map((ref) => (
                        <TableRow key={ref.id}>
                          <TableCell className="font-medium">{ref.title}</TableCell>
                          <TableCell>
                            {categories.find((c) => c.value === ref.category)?.label}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {ref.prompt}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteRefMutation.mutate(ref.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Templates de Projeto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Em breve...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Usuários</CardTitle>
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
    </div>
  );
}
