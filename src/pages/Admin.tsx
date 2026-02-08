import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { TemplatesTab } from '@/components/admin/TemplatesTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
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
  Trash2, 
  Loader2,
  LayoutTemplate,
  Users,
  Coins,
  Send,
  MoreHorizontal,
  UserPlus,
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

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // User management state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  
  // Create user state
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCredits, setNewUserCredits] = useState('5');

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
      setNewUserCredits('5');
      toast({ title: 'Usuário criado!', description: 'Um email de acesso foi enviado.' });
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

  const handleCreateUser = () => {
    if (newUserEmail.trim()) {
      createUserMutation.mutate({
        email: newUserEmail.trim(),
        credits: parseInt(newUserCredits) || 5,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Painel Admin</h1>
          <p className="text-muted-foreground">
            Gerencie templates e usuários
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Usuários</CardTitle>
                <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-full">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Adicionar Usuário
                    </Button>
                  </DialogTrigger>
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
                        <Label>Créditos Iniciais</Label>
                        <Input
                          type="number"
                          value={newUserCredits}
                          onChange={(e) => setNewUserCredits(e.target.value)}
                          placeholder="5"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreateUser}
                        disabled={createUserMutation.isPending || !newUserEmail.trim()}
                      >
                        {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar e Enviar Convite
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                        <TableHead>Nome</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead className="w-[150px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles?.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>{profile.email}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {profile.display_name || '-'}
                          </TableCell>
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

          {/* Templates Tab */}
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
        </Tabs>
      </main>

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
