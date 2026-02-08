import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NodeToolbar } from '@/components/editor/NodeToolbar';
import { PromptNode } from '@/components/nodes/PromptNode';
import { MediaNode } from '@/components/nodes/MediaNode';
import { SettingsNode } from '@/components/nodes/SettingsNode';
import { OutputNode } from '@/components/nodes/OutputNode';
import { ResultNode } from '@/components/nodes/ResultNode';
import { GravityNode } from '@/components/nodes/GravityNode';
import {
  ArrowLeft,
  Loader2,
  Upload,
  X,
  Save,
  Check
} from 'lucide-react';

const nodeTypes = {
  prompt: PromptNode,
  media: MediaNode,
  settings: SettingsNode,
  output: OutputNode,
  result: ResultNode,
  gravity: GravityNode
};

interface TemplateEditorCanvasProps {
  templateIdParam: string | null;
}

function TemplateEditorCanvas({ templateIdParam }: TemplateEditorCanvasProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateId, setTemplateId] = useState<string | null>(templateIdParam);
  const [templateName, setTemplateName] = useState('Novo Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!templateIdParam);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is admin
  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('has_role', {
        _user_id: user?.id,
        _role: 'admin'
      });
      return data;
    },
    enabled: !!user
  });

  // Redirect non-admins
  useEffect(() => {
    if (!checkingAdmin && isAdmin === false) {
      navigate('/');
    }
  }, [isAdmin, checkingAdmin, navigate]);

  // Load existing template
  useEffect(() => {
    const loadTemplate = async () => {
      if (!templateId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('project_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (error) {
          console.error('Load template error:', error);
          toast({
            title: 'Erro ao carregar template',
            description: error.message,
            variant: 'destructive'
          });
          navigate('/admin');
          return;
        }

        if (data) {
          setTemplateName(data.name);
          setTemplateDescription(data.description || '');
          setThumbnailUrl(data.thumbnail_url);
          const canvas = data.canvas_state as { nodes?: Node[]; edges?: Edge[] };
          if (canvas?.nodes) setNodes(canvas.nodes);
          if (canvas?.edges) setEdges(canvas.edges);
        }
      } catch (err) {
        console.error('Load template exception:', err);
      }
      setIsLoading(false);
    };

    loadTemplate();
  }, [templateId, setNodes, setEdges, toast, navigate]);

  // Save function with error handling
  const saveTemplate = useCallback(async (nodesToSave: Node[], edgesToSave: Edge[]) => {
    if (!user || isLoading) return;

    setIsSaving(true);
    try {
      const cleanNodes = nodesToSave.map(node => ({
        ...node,
        data: {
          ...node.data,
          onGenerate: undefined,
        }
      }));

      // Wrap serialization in try-catch to prevent crashes
      let canvasData;
      try {
        canvasData = JSON.parse(JSON.stringify({ nodes: cleanNodes, edges: edgesToSave }));
      } catch (serializationError) {
        console.error('Serialization error:', serializationError);
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível serializar os dados do canvas.',
          variant: 'destructive'
        });
        setIsSaving(false);
        return;
      }

      if (templateId) {
        const { error } = await supabase
          .from('project_templates')
          .update({
            name: templateName,
            description: templateDescription || null,
            thumbnail_url: thumbnailUrl,
            canvas_state: canvasData
          })
          .eq('id', templateId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('project_templates')
          .insert({
            name: templateName,
            description: templateDescription || null,
            thumbnail_url: thumbnailUrl,
            canvas_state: canvasData,
            created_by: user.id
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setTemplateId(data.id);
          navigate(`/admin/template-editor?id=${data.id}`, { replace: true });
        }
      }

      setLastSaved(new Date());
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Erro ao salvar',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
    setIsSaving(false);
  }, [user, isLoading, templateId, templateName, templateDescription, thumbnailUrl, toast, navigate]);

  // Auto-save with debounce
  useEffect(() => {
    if (!user || isLoading || checkingAdmin) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTemplate(nodes, edges);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, templateName, templateDescription, thumbnailUrl, user, isLoading, checkingAdmin, saveTemplate]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = useCallback(
    (type: string) => {
      if (type === 'settings') {
        const existingSettings = nodes.find((n) => n.type === 'settings');
        if (existingSettings) {
          toast({
            title: 'Limite atingido',
            description: 'Só é permitido um nó de configurações por projeto.',
            variant: 'destructive'
          });
          return;
        }
      }

      const id = `${type}-${Date.now()}`;
      const position = {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200
      };

      let data: Record<string, unknown> = {};
      switch (type) {
        case 'prompt':
          data = { label: 'Prompt', value: '' };
          break;
        case 'media':
          data = { label: 'Mídia', url: null };
          break;
        case 'settings':
          data = { label: 'Configurações', aspectRatio: '1:1', quantity: 1 };
          break;
        case 'output':
          data = { label: 'Resultado', images: [], isLoading: false };
          break;
        case 'result':
          data = { label: 'Resultado', aspectRatio: '1:1', quantity: 1, images: [] };
          break;
        case 'gravity':
          data = { label: 'Gravity', internalPrompt: '', internalMediaUrls: [] };
          break;
      }

      const newNode: Node = { id, type, position, data };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes, toast]
  );

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

      setThumbnailUrl(urlData.publicUrl);
      toast({ title: 'Thumbnail enviada!' });
    } catch (error) {
      toast({
        title: 'Erro no upload',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const clearThumbnail = () => {
    setThumbnailUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  if (checkingAdmin || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-border" />
          <h2 className="font-semibold">
            {templateId ? 'Editar Template' : 'Novo Template'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {isSaving ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Salvando...
            </span>
          ) : lastSaved ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-500" />
              Salvo
            </span>
          ) : null}
          <Button
            size="sm"
            onClick={() => saveTemplate(nodes, edges)}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      {/* Metadata Section */}
      <div className="border-b border-border bg-muted/30 px-4 py-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Name */}
          <div>
            <Label htmlFor="template-name" className="text-xs">Nome do Template</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ex: Template para Produtos"
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="template-desc" className="text-xs">Descrição</Label>
            <Textarea
              id="template-desc"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Descreva o uso do template..."
              className="mt-1 resize-none h-10"
              rows={1}
            />
          </div>

          {/* Thumbnail */}
          <div>
            <Label className="text-xs">Thumbnail</Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            {thumbnailUrl ? (
              <div className="relative mt-1 flex items-center gap-2">
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail"
                  className="h-10 w-16 object-cover rounded border border-border"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearThumbnail}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="mt-1 w-full"
              >
                <Upload className={`h-4 w-4 mr-2 ${uploadingImage ? 'animate-pulse' : ''}`} />
                {uploadingImage ? 'Enviando...' : 'Upload'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <NodeToolbar onAddNode={addNode} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={memoizedNodeTypes}
          fitView
          className="bg-background"
        >
          <Controls className="!bg-card/90 !backdrop-blur-sm !border-border !rounded-xl" />
          <MiniMap
            className="!bg-card/90 !backdrop-blur-sm !rounded-xl"
            nodeColor={() => 'hsl(var(--primary))'}
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function TemplateEditor() {
  const [searchParams] = useSearchParams();
  const templateIdParam = searchParams.get('id');

  return (
    <ReactFlowProvider>
      <TemplateEditorCanvas templateIdParam={templateIdParam} />
    </ReactFlowProvider>
  );
}
