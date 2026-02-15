import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Check, X, MessageSquare, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Submission {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  image_url: string;
  category_slug: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface ReferenceCategory {
  id: string;
  slug: string;
  label: string;
}

export function SubmissionsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rejectNote, setRejectNote] = useState('');

  const { data: categories = [] } = useQuery({
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

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['admin-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profiles for user info
      const userIds = [...new Set((data || []).map(s => s.user_id))];
      if (userIds.length === 0) return data as Submission[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, { email: p.email, name: p.display_name }])
      );

      return (data || []).map(s => ({
        ...s,
        user_email: profileMap.get(s.user_id)?.email,
        user_name: profileMap.get(s.user_id)?.name,
      })) as Submission[];
    },
  });

  const pendingSubmissions = submissions.filter(s => s.status === 'pending');
  const processedSubmissions = submissions.filter(s => s.status !== 'pending');

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubmission || !user) throw new Error('Missing data');

      // 1. Create reference image with submitted_by
      const { data: newImage, error: imgError } = await supabase
        .from('reference_images')
        .insert({
          title: selectedSubmission.title,
          prompt: selectedSubmission.prompt,
          category: selectedSubmission.category_slug,
          image_url: selectedSubmission.image_url,
          created_by: user.id,
          submitted_by: selectedSubmission.user_id,
        })
        .select('id')
        .single();
      if (imgError) throw imgError;

      // 2. Insert tags
      if (selectedTags.length > 0) {
        const { error: tagError } = await supabase
          .from('reference_image_tags')
          .insert(selectedTags.map(catId => ({ image_id: newImage.id, category_id: catId })));
        if (tagError) throw tagError;
      }

      // 3. Give +2 credits to user
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('user_id', selectedSubmission.user_id)
        .single();
      
      if (profile) {
        const { error: creditError } = await supabase
          .from('profiles')
          .update({ credits: profile.credits + 2 })
          .eq('user_id', selectedSubmission.user_id);
        if (creditError) throw creditError;
      }

      // 4. Update submission status
      const { error: statusError } = await supabase
        .from('community_submissions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', selectedSubmission.id);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-references'] });
      queryClient.invalidateQueries({ queryKey: ['library-images-with-tags'] });
      setApproveDialogOpen(false);
      setSelectedSubmission(null);
      setSelectedTags([]);
      toast({ title: 'Submissão aprovada!', description: '+2 créditos concedidos ao autor.' });
    },
    onError: (err) => {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubmission || !user) throw new Error('Missing data');
      const { error } = await supabase
        .from('community_submissions')
        .update({
          status: 'rejected',
          admin_note: rejectNote || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', selectedSubmission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      setRejectDialogOpen(false);
      setSelectedSubmission(null);
      setRejectNote('');
      toast({ title: 'Submissão rejeitada.' });
    },
    onError: (err) => {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    },
  });

  const toggleTag = (catId: string) => {
    setSelectedTags(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const openApprove = (sub: Submission) => {
    setSelectedSubmission(sub);
    // Pre-select tag matching category_slug
    const matchingCat = categories.find(c => c.slug === sub.category_slug);
    setSelectedTags(matchingCat ? [matchingCat.id] : []);
    setApproveDialogOpen(true);
  };

  const openReject = (sub: Submission) => {
    setSelectedSubmission(sub);
    setRejectNote('');
    setRejectDialogOpen(true);
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Submissões da Comunidade
            {pendingSubmissions.length > 0 && (
              <Badge variant="default" className="ml-2">{pendingSubmissions.length} pendentes</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : pendingSubmissions.length === 0 && processedSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nenhuma submissão ainda</h3>
              <p className="text-sm text-muted-foreground">
                Quando os usuários enviarem imagens, elas aparecerão aqui para revisão.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {pendingSubmissions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">Pendentes</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Imagem</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingSubmissions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <img src={sub.image_url} alt={sub.title} className="w-14 h-14 object-cover rounded-lg border border-border" />
                          </TableCell>
                          <TableCell className="font-medium">{sub.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sub.user_name || sub.user_email || 'Desconhecido'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {categories.find(c => c.slug === sub.category_slug)?.label || sub.category_slug}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(sub.created_at), "d MMM", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="default" className="h-8" onClick={() => openApprove(sub)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => openReject(sub)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {processedSubmissions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">Processadas</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Imagem</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedSubmissions.slice(0, 20).map((sub) => (
                        <TableRow key={sub.id} className="opacity-60">
                          <TableCell>
                            <img src={sub.image_url} alt={sub.title} className="w-14 h-14 object-cover rounded-lg border border-border" />
                          </TableCell>
                          <TableCell className="font-medium">{sub.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sub.user_name || sub.user_email || 'Desconhecido'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sub.status === 'approved' ? 'default' : 'destructive'}>
                              {sub.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(sub.created_at), "d MMM", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar submissão</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <img src={selectedSubmission.image_url} alt={selectedSubmission.title} className="w-24 h-24 object-cover rounded-lg" />
                <div>
                  <p className="font-semibold">{selectedSubmission.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{selectedSubmission.prompt}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por: {selectedSubmission.user_name || selectedSubmission.user_email}
                  </p>
                </div>
              </div>
              <div>
                <Label>Tags / Categorias</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {categories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant={selectedTags.includes(cat.id) ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleTag(cat.id)}
                    >
                      {cat.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Ao aprovar, o autor receberá <strong>+2 créditos</strong>.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || selectedTags.length === 0}>
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aprovar e dar créditos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar submissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deseja informar o motivo da rejeição? (opcional)
            </p>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Motivo da rejeição..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
