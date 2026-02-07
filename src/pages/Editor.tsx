import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Connection, Node, Edge, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Header } from '@/components/layout/Header';
import { PromptNode } from '@/components/nodes/PromptNode';
import { MediaNode } from '@/components/nodes/MediaNode';
import { SettingsNode, GENERATING_STATE_EVENT } from '@/components/nodes/SettingsNode';
import { OutputNode } from '@/components/nodes/OutputNode';
import { NodeToolbar } from '@/components/editor/NodeToolbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const nodeTypes = {
  prompt: PromptNode,
  media: MediaNode,
  settings: SettingsNode,
  output: OutputNode
};

// Custom event for triggering generation
export const GENERATE_IMAGE_EVENT = 'editor:generate-image';

interface EditorCanvasProps {
  projectId: string | null;
}

function EditorCanvas({ projectId }: EditorCanvasProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [projectName, setProjectName] = useState('Sem título');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load project
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        setIsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (error) {
          console.error('Load project error:', error);
          toast({
            title: 'Erro ao carregar projeto',
            description: error.message,
            variant: 'destructive'
          });
        } else if (data) {
          setProjectName(data.name);
          const canvasState = data.canvas_state as { nodes?: Node[]; edges?: Edge[] };
          if (canvasState?.nodes) setNodes(canvasState.nodes);
          if (canvasState?.edges) setEdges(canvasState.edges);
        }
      } catch (err) {
        console.error('Load project exception:', err);
      }
      setIsLoading(false);
    };
    loadProject();
  }, [projectId, user, setNodes, setEdges, toast]);

  // Save function with error handling
  const saveProject = useCallback(async (nodesToSave: Node[], edgesToSave: Edge[]) => {
    if (!projectId || !user || isLoading) return;
    
    setIsSaving(true);
    try {
      // Create a clean copy without functions
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

      const { error } = await supabase
        .from('projects')
        .update({
          canvas_state: canvasData,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) {
        console.error('Save error:', error);
      }
    } catch (err) {
      console.error('Save exception:', err);
    }
    setIsSaving(false);
  }, [projectId, user, isLoading, toast]);

  // Auto-save with debounce
  useEffect(() => {
    if (!projectId || !user || isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProject(nodes, edges);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, projectId, user, isLoading, saveProject]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Ref to store current nodes/edges for generation without causing re-renders
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  
  // Keep refs in sync
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const handleGenerate = useCallback(async () => {
    // Use refs to access current state without depending on them
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    const settingsNode = currentNodes.find((n) => n.type === 'settings');
    const outputNode = currentNodes.find((n) => n.type === 'output');

    if (!settingsNode || !outputNode) {
      toast({
        title: 'Configure o fluxo',
        description: 'Conecte os nós de configuração e resultado.',
        variant: 'destructive'
      });
      return;
    }

    const quantity = (settingsNode.data as { quantity?: number }).quantity || 1;
    const creditsNeeded = quantity; // 1 credit per image

    if (!profile || profile.credits < creditsNeeded) {
      toast({
        title: 'Créditos insuficientes',
        description: `Você precisa de ${creditsNeeded} ${creditsNeeded === 1 ? 'crédito' : 'créditos'} para gerar ${quantity} ${quantity === 1 ? 'imagem' : 'imagens'}.`,
        variant: 'destructive'
      });
      return;
    }

    const inputEdges = currentEdges.filter((e) => e.target === settingsNode.id);
    const promptNodes = inputEdges
      .map((e) => currentNodes.find((n) => n.id === e.source && n.type === 'prompt'))
      .filter(Boolean) as Node[];
    const mediaNodes = inputEdges
      .map((e) => currentNodes.find((n) => n.id === e.source && n.type === 'media'))
      .filter(Boolean) as Node[];

    if (promptNodes.length === 0) {
      toast({
        title: 'Adicione um prompt',
        description: 'Conecte pelo menos um nó de prompt.',
        variant: 'destructive'
      });
      return;
    }

    const prompt = promptNodes.map((n) => (n.data as { value: string }).value).join(' ');
    const aspectRatio = (settingsNode.data as { aspectRatio: string }).aspectRatio;
    const imageUrls = mediaNodes
      .map((n) => (n.data as { url: string | null }).url)
      .filter(Boolean) as string[];

    // Dispatch generating state event to SettingsNode
    window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: true } }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, aspectRatio, quantity, imageUrls, projectId }
      });

      if (error) throw error;

      // Create new image objects with metadata
      const newImages = data.images.map((url: string) => ({
        url,
        prompt,
        aspectRatio,
        savedToGallery: false,
        generatedAt: new Date().toISOString(),
      }));

      // Update output node - ACCUMULATE images instead of replacing
      setNodes((nds) => {
        const updated = nds.map((n) => {
          if (n.id === outputNode.id) {
            const existingImages = (n.data as { images?: unknown[] }).images || [];
            // Normalize existing images to new format if needed
            const normalizedExisting = Array.isArray(existingImages) 
              ? existingImages.map((img: unknown) => 
                  typeof img === 'string' 
                    ? { url: img, prompt: '', aspectRatio: '1:1', savedToGallery: false, generatedAt: new Date().toISOString() }
                    : img
                )
              : [];
            
            return {
              ...n,
              data: {
                ...n.data,
                images: [...normalizedExisting, ...newImages],
              },
            };
          }
          return n;
        });
        // Force save after generation
        setTimeout(() => saveProject(updated, currentEdges), 100);
        return updated;
      });

      // Reset generating state
      window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: false } }));

      toast({ title: `${data.images.length} ${data.images.length === 1 ? 'imagem gerada' : 'imagens geradas'} com sucesso!` });
    } catch (error) {
      console.error('Generation error:', error);
      // Reset generating state on error
      window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: false } }));
      toast({
        title: 'Erro na geração',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  }, [profile, projectId, setNodes, toast, saveProject]);

  // Listen for generate events from SettingsNode
  useEffect(() => {
    const handler = () => {
      handleGenerate();
    };
    
    window.addEventListener(GENERATE_IMAGE_EVENT, handler);
    return () => window.removeEventListener(GENERATE_IMAGE_EVENT, handler);
  }, [handleGenerate]);

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
      }

      const newNode: Node = { id, type, position, data };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes, toast]
  );

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

export default function Editor() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  return (
    <ReactFlowProvider>
      <EditorCanvas projectId={projectId} />
    </ReactFlowProvider>
  );
}
