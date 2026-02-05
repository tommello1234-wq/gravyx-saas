import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Header } from '@/components/layout/Header';
import { PromptNode } from '@/components/nodes/PromptNode';
import { MediaNode } from '@/components/nodes/MediaNode';
import { SettingsNode } from '@/components/nodes/SettingsNode';
import { OutputNode } from '@/components/nodes/OutputNode';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Type, 
  Image, 
  Settings, 
  Sparkles,
  Save,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const nodeTypes = {
  prompt: PromptNode,
  media: MediaNode,
  settings: SettingsNode,
  output: OutputNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function Editor() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [projectName, setProjectName] = useState('Sem título');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load project
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        toast({
          title: 'Erro ao carregar projeto',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        setProjectName(data.name);
        const canvasState = data.canvas_state as { nodes?: Node[]; edges?: Edge[] };
        if (canvasState?.nodes) setNodes(canvasState.nodes);
        if (canvasState?.edges) setEdges(canvasState.edges);
      }

      setIsLoading(false);
    };

    loadProject();
  }, [projectId, user, setNodes, setEdges, toast]);

  // Auto-save with debounce
  useEffect(() => {
    if (!projectId || !user || isLoading) return;

    const timeout = setTimeout(async () => {
      setIsSaving(true);
      const { error } = await supabase
        .from('projects')
        .update({
          canvas_state: JSON.parse(JSON.stringify({ nodes, edges })),
        })
        .eq('id', projectId);

      if (error) {
        console.error('Auto-save error:', error);
      }
      setIsSaving(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [nodes, edges, projectId, user, isLoading]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = useCallback((type: string) => {
    const id = `${type}-${Date.now()}`;
    const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
    
    let data: Record<string, unknown> = {};
    
    switch (type) {
      case 'prompt':
        data = { label: 'Prompt', value: '' };
        break;
      case 'media':
        data = { label: 'Mídia', url: null };
        break;
      case 'settings':
        data = { 
          label: 'Configurações', 
          aspectRatio: '1:1', 
          quantity: 1,
          onGenerate: () => handleGenerate(),
        };
        break;
      case 'output':
        data = { label: 'Resultado', images: [], isLoading: false };
        break;
    }

    const newNode: Node = {
      id,
      type,
      position,
      data,
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const handleGenerate = useCallback(async () => {
    if (!profile || profile.credits < 1) {
      toast({
        title: 'Créditos insuficientes',
        description: 'Você precisa de créditos para gerar imagens.',
        variant: 'destructive',
      });
      return;
    }

    // Find connected nodes
    const settingsNode = nodes.find(n => n.type === 'settings');
    const outputNode = nodes.find(n => n.type === 'output');
    
    if (!settingsNode || !outputNode) {
      toast({
        title: 'Configure o fluxo',
        description: 'Conecte os nós de configuração e resultado.',
        variant: 'destructive',
      });
      return;
    }

    // Find connected prompt nodes
    const promptEdges = edges.filter(e => e.target === settingsNode.id);
    const promptNodes = promptEdges
      .map(e => nodes.find(n => n.id === e.source && n.type === 'prompt'))
      .filter(Boolean) as Node[];

    if (promptNodes.length === 0) {
      toast({
        title: 'Adicione um prompt',
        description: 'Conecte pelo menos um nó de prompt.',
        variant: 'destructive',
      });
      return;
    }

    const prompt = promptNodes.map(n => (n.data as { value: string }).value).join(' ');
    const aspectRatio = (settingsNode.data as { aspectRatio: string }).aspectRatio;
    const quantity = (settingsNode.data as { quantity: number }).quantity;

    // Set loading state on output node
    setNodes(nds => nds.map(n => 
      n.id === outputNode.id 
        ? { ...n, data: { ...n.data, isLoading: true } }
        : n
    ));

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { 
          prompt, 
          aspectRatio, 
          quantity,
          projectId,
        },
      });

      if (error) throw error;

      // Update output node with images
      setNodes(nds => nds.map(n => 
        n.id === outputNode.id 
          ? { ...n, data: { ...n.data, images: data.images, isLoading: false } }
          : n
      ));

      toast({ title: 'Imagens geradas com sucesso!' });
    } catch (error) {
      console.error('Generation error:', error);
      setNodes(nds => nds.map(n => 
        n.id === outputNode.id 
          ? { ...n, data: { ...n.data, isLoading: false } }
          : n
      ));
      toast({
        title: 'Erro na geração',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  }, [nodes, edges, profile, projectId, setNodes, toast]);

  // Memoize nodeTypes to prevent React Flow warnings
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      
      {/* Toolbar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold">{projectName}</h2>
          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Salvando...
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar nó
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => addNode('prompt')}>
                <Type className="h-4 w-4 mr-2 text-node-prompt" />
                Prompt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNode('media')}>
                <Image className="h-4 w-4 mr-2 text-node-media" />
                Mídia
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNode('settings')}>
                <Settings className="h-4 w-4 mr-2 text-node-settings" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNode('output')}>
                <Sparkles className="h-4 w-4 mr-2 text-node-output" />
                Resultado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            size="sm" 
            className="rounded-full glow-primary"
            onClick={handleGenerate}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
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
          <Controls className="!bg-card/80 !backdrop-blur-sm !border-border" />
          <MiniMap 
            className="!bg-card/80 !backdrop-blur-sm" 
            nodeColor={() => 'hsl(var(--primary))'}
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
        </ReactFlow>
      </div>
    </div>
  );
}
