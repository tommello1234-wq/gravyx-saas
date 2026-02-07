import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Connection, Node, Edge, BackgroundVariant } from '@xyflow/react';
import type { Json } from '@/integrations/supabase/types';
import '@xyflow/react/dist/style.css';
import { Header } from '@/components/layout/Header';
import { PromptNode } from '@/components/nodes/PromptNode';
import { MediaNode } from '@/components/nodes/MediaNode';
import { SettingsNode, GENERATING_STATE_EVENT, JOB_QUEUE_STATE_EVENT } from '@/components/nodes/SettingsNode';
import { OutputNode } from '@/components/nodes/OutputNode';
import { NodeToolbar } from '@/components/editor/NodeToolbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useJobQueue } from '@/hooks/useJobQueue';
import { Loader2 } from 'lucide-react';

const nodeTypes = {
  prompt: PromptNode,
  media: MediaNode,
  settings: SettingsNode,
  output: OutputNode
};

// Custom event for triggering generation
export const GENERATE_IMAGE_EVENT = 'editor:generate-image';

// Max canvas_state size before triggering auto-repair (1MB)
const MAX_CANVAS_SIZE = 1_000_000;

interface EditorCanvasProps {
  projectId: string | null;
}

// Helper: Sanitize canvas state for persistence - removes images and transient fields
function sanitizeCanvasState(nodes: Node[], edges: Edge[]): Json {
  const cleanNodes = nodes.map(node => {
    // Remove transient ReactFlow fields
    const { selected, dragging, measured, width, height, ...restNode } = node as Node & {
      selected?: boolean;
      dragging?: boolean;
      measured?: { width: number; height: number };
      width?: number;
      height?: number;
    };
    
    // Clean data object - create a new object without function refs
    const cleanData: Record<string, unknown> = {};
    for (const key in restNode.data) {
      if (key !== 'onGenerate' && typeof restNode.data[key] !== 'function') {
        cleanData[key] = restNode.data[key];
      }
    }
    
    // For output nodes: remove images entirely (they come from generations table)
    if (node.type === 'output') {
      delete cleanData.images;
    }
    
    // For media nodes: remove base64 URLs (keep only storage URLs)
    if (node.type === 'media' && cleanData.url && typeof cleanData.url === 'string') {
      if ((cleanData.url as string).startsWith('data:image')) {
        cleanData.url = null;
      }
    }
    
    return {
      id: restNode.id,
      type: restNode.type,
      position: restNode.position,
      data: cleanData,
    };
  });
  
  // Clean edges too - only keep serializable properties
  const cleanEdges = edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));
  
  return { nodes: cleanNodes, edges: cleanEdges } as unknown as Json;
}

// Helper: Detect if canvas needs repair (contains base64 or is too large)
function needsAutoRepair(canvasState: { nodes?: Node[]; edges?: Edge[] }): boolean {
  const serialized = JSON.stringify(canvasState);
  
  // Check size
  if (serialized.length > MAX_CANVAS_SIZE) {
    return true;
  }
  
  // Check for base64 images
  if (serialized.includes('data:image')) {
    return true;
  }
  
  return false;
}

// Helper: Remove base64 and images from canvas state for repair
function repairCanvasState(canvasState: { nodes?: Node[]; edges?: Edge[] }): { nodes: Node[]; edges: Edge[] } {
  const nodes = (canvasState.nodes || []).map(node => {
    const cleanData = { ...node.data };
    
    // Remove images from output nodes
    if (node.type === 'output') {
      delete cleanData.images;
    }
    
    // Remove base64 URLs from media nodes
    if (node.type === 'media' && cleanData.url && typeof cleanData.url === 'string') {
      if (cleanData.url.startsWith('data:image')) {
        cleanData.url = null;
      }
    }
    
    return { ...node, data: cleanData };
  });
  
  return { nodes, edges: canvasState.edges || [] };
}

function EditorCanvas({ projectId }: EditorCanvasProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [projectName, setProjectName] = useState('Sem título');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const toastRef = useRef(toast);
  const setNodesRef = useRef(setNodes);
  const pollingFallbackRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedAtRef = useRef<string>('');

  // Keep refs in sync
  useEffect(() => {
    toastRef.current = toast;
    setNodesRef.current = setNodes;
  }, [toast, setNodes]);

  // Job completed handler - add images to output node
  const handleJobCompleted = useCallback((result: { jobId: string; resultUrls: string[]; resultCount: number }) => {
    const currentNodes = nodesRef.current;
    const outputNode = currentNodes.find((n) => n.type === 'output');
    
    if (!outputNode) return;

    // CORREÇÃO: Validar resultUrls antes de usar - evita crash em payloads malformados
    const urls = Array.isArray(result.resultUrls) ? result.resultUrls : [];
    if (urls.length === 0) {
      console.warn('Job completed but no result URLs provided:', result.jobId);
      return;
    }

    const newImages = urls.map(url => ({
      url,
      prompt: '',
      aspectRatio: '1:1',
      savedToGallery: true,
      generatedAt: new Date().toISOString(),
    }));

    setNodesRef.current((nds) => {
      return nds.map((n) => {
        if (n.id === outputNode.id) {
          const existingImages = (n.data as { images?: unknown[] }).images || [];
          return {
            ...n,
            data: {
              ...n.data,
              images: [...(Array.isArray(existingImages) ? existingImages : []), ...newImages],
            },
          };
        }
        return n;
      });
    });

    toastRef.current({ 
      title: `${result.resultCount} ${result.resultCount === 1 ? 'imagem gerada' : 'imagens geradas'} com sucesso!` 
    });
    
    // Refresh profile to update credits display
    refreshProfile();
  }, [refreshProfile]);

  // Job failed handler
  const handleJobFailed = useCallback((jobId: string, error: string) => {
    toastRef.current({
      title: 'Falha na geração',
      description: error,
      variant: 'destructive'
    });
    
    // Refresh profile to update credits (might have been refunded)
    refreshProfile();
  }, [refreshProfile]);

  // Job queue hook
  const { 
    pendingJobs, 
    addPendingJob, 
    hasQueuedJobs, 
    hasProcessingJobs, 
    totalPendingImages 
  } = useJobQueue({
    projectId,
    onJobCompleted: handleJobCompleted,
    onJobFailed: handleJobFailed
  });

  // Dispatch job queue state to SettingsNode
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(JOB_QUEUE_STATE_EVENT, { 
      detail: { hasQueuedJobs, hasProcessingJobs, totalPendingImages } 
    }));
  }, [hasQueuedJobs, hasProcessingJobs, totalPendingImages]);

  // Load project and populate output node with images from generations table
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        setIsLoading(false);
        return;
      }
      try {
        // Load project with only needed fields
        const { data, error } = await supabase
          .from('projects')
          .select('name, canvas_state')
          .eq('id', projectId)
          .single();

        if (error) {
          console.error('Load project error:', error);
          toast({
            title: 'Erro ao carregar projeto',
            description: error.message,
            variant: 'destructive'
          });
          setIsLoading(false);
          return;
        }
        
        if (data) {
          setProjectName(data.name);
          const canvasState = data.canvas_state as { nodes?: Node[]; edges?: Edge[] };
          
          // Check if auto-repair is needed
          const needsRepair = needsAutoRepair(canvasState);
          
          let loadedNodes = canvasState?.nodes || [];
          let loadedEdges = canvasState?.edges || [];
          
          if (needsRepair) {
            console.log('Auto-repair triggered: sanitizing canvas_state');
            const repaired = repairCanvasState(canvasState);
            loadedNodes = repaired.nodes;
            loadedEdges = repaired.edges;
            
            // Save repaired state back to database immediately
            const cleanState = sanitizeCanvasState(loadedNodes, loadedEdges);
            const { error: updateError } = await supabase
              .from('projects')
              .update({
                canvas_state: cleanState,
                updated_at: new Date().toISOString()
              })
              .eq('id', projectId);
            
            if (updateError) {
              console.error('Auto-repair save error:', updateError);
            } else {
              console.log('Auto-repair completed successfully');
              toast({
                title: 'Projeto otimizado',
                description: 'Removemos imagens antigas do canvas para melhorar a performance. Suas imagens continuam na Galeria.',
              });
              
              // Update lastSavedDataRef
              lastSavedDataRef.current = JSON.stringify(cleanState);
            }
          }
          
          // Load historical images from generations table for output node
          const { data: generations } = await supabase
            .from('generations')
            .select('image_url, prompt, aspect_ratio, created_at')
            .eq('project_id', projectId)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(50);
          
          // Populate output node with images from generations
          if (generations && generations.length > 0) {
            const historicalImages = generations.map(gen => ({
              url: gen.image_url,
              prompt: gen.prompt,
              aspectRatio: gen.aspect_ratio,
              savedToGallery: true,
              generatedAt: gen.created_at,
            })).reverse(); // Show oldest first
            
            loadedNodes = loadedNodes.map(node => {
              if (node.type === 'output') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    images: historicalImages,
                  },
                };
              }
              return node;
            });
          }
          
          setNodes(loadedNodes);
          setEdges(loadedEdges);
        }
      } catch (err) {
        console.error('Load project exception:', err);
      }
      setIsLoading(false);
    };
    loadProject();
  }, [projectId, user, setNodes, setEdges, toast]);

  // Save function with sanitization - uses ref for toast to avoid dependency issues
  const saveProject = useCallback(async (nodesToSave: Node[], edgesToSave: Edge[]) => {
    if (!projectId || !user || isLoading) return;
    
    // Sanitize canvas state before saving (removes images, base64, transient fields)
    const cleanState = sanitizeCanvasState(nodesToSave, edgesToSave);

    // Check if data actually changed before saving
    let dataString: string;
    try {
      dataString = JSON.stringify(cleanState);
    } catch (serializationError) {
      console.error('Serialization error:', serializationError);
      toastRef.current({
        title: 'Erro ao salvar',
        description: 'Não foi possível serializar os dados do canvas.',
        variant: 'destructive'
      });
      return;
    }

    // Skip save if data hasn't changed
    if (dataString === lastSavedDataRef.current) {
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          canvas_state: cleanState,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) {
        console.error('Save error:', error);
      } else {
        // Only update lastSavedDataRef on successful save
        lastSavedDataRef.current = dataString;
      }
    } catch (err) {
      console.error('Save exception:', err);
    }
    setIsSaving(false);
  }, [projectId, user, isLoading]);

  // Auto-save with debounce
  useEffect(() => {
    if (!projectId || !user || isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProject(nodes, edges);
    }, 3000);

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

    // Dispatch generating state event to SettingsNode (brief "sending" state)
    window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: true } }));

    try {
      // Call generate-image which now only enqueues the job
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, aspectRatio, quantity, imageUrls, projectId }
      });

      if (error) throw error;

      // Add job to pending queue - images will arrive via Realtime
      addPendingJob(data.jobId, data.quantity);

      // Reset "sending" state - job is now queued
      window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: false } }));

      toast({ 
        title: 'Geração iniciada',
        description: `${quantity} ${quantity === 1 ? 'imagem está sendo gerada' : 'imagens estão sendo geradas'}...`
      });

      // Refresh profile to show updated credits
      refreshProfile();
      
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
  }, [profile, projectId, toast, addPendingJob, refreshProfile]);

  // Listen for generate events from SettingsNode
  useEffect(() => {
    const handler = () => {
      handleGenerate();
    };
    
    window.addEventListener(GENERATE_IMAGE_EVENT, handler);
    return () => window.removeEventListener(GENERATE_IMAGE_EVENT, handler);
  }, [handleGenerate]);

  // POLLING FALLBACK: Check for new images every 5 seconds when there are pending jobs
  useEffect(() => {
    if (!projectId || pendingJobs.length === 0) {
      if (pollingFallbackRef.current) {
        clearInterval(pollingFallbackRef.current);
        pollingFallbackRef.current = null;
      }
      return;
    }

    const checkForNewImages = async () => {
      try {
        // Fetch recent generations from DB
        const { data: generations, error } = await supabase
          .from('generations')
          .select('image_url, prompt, aspect_ratio, created_at')
          .eq('project_id', projectId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error || !generations) return;

        // Check if we have new images since last sync
        const newestCreatedAt = generations[0]?.created_at || '';
        if (newestCreatedAt && newestCreatedAt !== lastSyncedAtRef.current) {
          console.log('Polling fallback: detected new images, syncing...');
          lastSyncedAtRef.current = newestCreatedAt;

          // Get all images and update output node
          const allImages = generations.map(gen => ({
            url: gen.image_url,
            prompt: gen.prompt,
            aspectRatio: gen.aspect_ratio,
            savedToGallery: true,
            generatedAt: gen.created_at,
          })).reverse();

          setNodesRef.current((nds) =>
            nds.map((n) => {
              if (n.type === 'output') {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    images: allImages,
                  },
                };
              }
              return n;
            })
          );
        }
      } catch (err) {
        console.error('Polling fallback error:', err);
      }
    };

    // Initial check after 2 seconds
    const initialTimeout = setTimeout(checkForNewImages, 2000);
    
    // Then poll every 5 seconds
    pollingFallbackRef.current = setInterval(checkForNewImages, 5000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingFallbackRef.current) {
        clearInterval(pollingFallbackRef.current);
        pollingFallbackRef.current = null;
      }
    };
  }, [projectId, pendingJobs.length]);

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
