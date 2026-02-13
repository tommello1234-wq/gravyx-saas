import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type { Json } from '@/integrations/supabase/types';

interface SaveAsTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: Node[];
  edges: Edge[];
  projectName: string;
  userId: string;
  sanitizeCanvasState: (nodes: Node[], edges: Edge[]) => Json;
}

interface TemplateOption {
  id: string;
  name: string;
}

export function SaveAsTemplateModal({
  open,
  onOpenChange,
  nodes,
  edges,
  projectName,
  userId,
  sanitizeCanvasState,
}: SaveAsTemplateModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>('new');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Pre-fill name when modal opens
  useEffect(() => {
    if (open) {
      setName(projectName);
      setDescription('');
      setSelectedTemplateId('');
      loadTemplates();
    }
  }, [open, projectName]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    const { data, error } = await supabase
      .from('project_templates')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setTemplates(data);
    }
    setIsLoadingTemplates(false);
  };

  const handleSaveNew = async () => {
    if (!name.trim()) {
      toast({ title: 'Preencha o nome do template', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const canvasState = sanitizeCanvasState(nodes, edges);

    const { error } = await supabase.from('project_templates').insert({
      name: name.trim(),
      description: description.trim() || null,
      canvas_state: canvasState,
      created_by: userId,
    });

    setIsSaving(false);

    if (error) {
      toast({ title: 'Erro ao criar template', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Template criado com sucesso!' });
      onOpenChange(false);
    }
  };

  const handleUpdateExisting = async () => {
    if (!selectedTemplateId) {
      toast({ title: 'Selecione um template para atualizar', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const canvasState = sanitizeCanvasState(nodes, edges);

    const { error } = await supabase
      .from('project_templates')
      .update({ canvas_state: canvasState })
      .eq('id', selectedTemplateId);

    setIsSaving(false);

    if (error) {
      toast({ title: 'Erro ao atualizar template', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Template atualizado com sucesso!' });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como Template</DialogTitle>
          <DialogDescription>
            Salve o canvas atual como um template para outros usuários utilizarem.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="new" className="flex-1">Novo Template</TabsTrigger>
            <TabsTrigger value="update" className="flex-1">Atualizar Existente</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-desc">Descrição (opcional)</Label>
              <Input
                id="template-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição do template"
              />
            </div>
            <Button onClick={handleSaveNew} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Template
            </Button>
          </TabsContent>

          <TabsContent value="update" className="space-y-4 mt-4">
            {isLoadingTemplates ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum template existente encontrado.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Selecione o template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={handleUpdateExisting}
              disabled={isSaving || !selectedTemplateId}
              className="w-full"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Atualizar Template
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
