import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Connection, Node, Edge, BackgroundVariant } from '@xyflow/react';
import type { Json } from '@/integrations/supabase/types';
import '@xyflow/react/dist/style.css';
import { Header } from '@/components/layout/Header';
import { PromptNode } from '@/components/nodes/PromptNode';
import { MediaNode } from '@/components/nodes/MediaNode';
import { SettingsNode, GENERATING_STATE_EVENT, JOB_QUEUE_STATE_EVENT } from '@/components/nodes/SettingsNode';
import { OutputNode } from '@/components/nodes/OutputNode';
import { ResultNode, GENERATE_FOR_RESULT_EVENT, RESULT_GENERATING_STATE_EVENT, RESULT_JOB_QUEUE_STATE_EVENT, ResultNodeData } from '@/components/nodes/ResultNode';
import { GravityNode, GENERATE_ALL_FROM_GRAVITY_EVENT, GRAVITY_GENERATING_STATE_EVENT, GravityNodeData } from '@/components/nodes/GravityNode';
import { NodeToolbar } from '@/components/editor/NodeToolbar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useJobQueue } from '@/hooks/useJobQueue';
import { Loader2 } from 'lucide-react';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';

const nodeTypes = {
  prompt: PromptNode,
  media: MediaNode,
  settings: SettingsNode,
  output: OutputNode,
  result: ResultNode,
  gravity: GravityNode
};

// Custom event for triggering generation (legacy)
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
    
    // For output/result nodes: remove images entirely (they come from generations table)
    if (node.type === 'output' || node.type === 'result') {
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
    
    // Remove images from output/result nodes
    if (node.type === 'output' || node.type === 'result') {
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

// Helper: Collect context from a Gravity node
function collectGravityContext(
  gravityId: string, 
  nodes: Node[], 
  edges: Edge[]
): { prompts: string[]; medias: string[] } {
  const gravityNode = nodes.find(n => n.id === gravityId);
  if (!gravityNode) return { prompts: [], medias: [] };
  
  const gravityData = gravityNode.data as unknown as GravityNodeData;
  
  // Prompts connected to the Gravity
  const inputEdges = edges.filter(e => e.target === gravityId);
  const connectedPrompts = inputEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'prompt'))
    .filter(Boolean)
    .map(n => (n!.data as { value?: string }).value)
    .filter(Boolean) as string[];
  
  // Medias connected to the Gravity
  const connectedMedias = inputEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'media'))
    .filter(Boolean)
    .map(n => (n!.data as { url?: string | null }).url)
    .filter(Boolean) as string[];
  
  // Internal data from the Gravity popup
  const internalPrompt = gravityData.internalPrompt || '';
  const internalMedias = gravityData.internalMediaUrls || [];
  
  return {
    prompts: [...connectedPrompts, internalPrompt].filter(Boolean),
    medias: [...connectedMedias, ...internalMedias]
  };
}

// Helper: Find if a Result node is connected to a Gravity
function findConnectedGravity(resultId: string, nodes: Node[], edges: Edge[]): string | null {
  const inputEdges = edges.filter(e => e.target === resultId);
  for (const edge of inputEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode?.type === 'gravity') {
      return sourceNode.id;
    }
  }
  return null;
}

// Helper: Collect local context connected directly to a Result node
function collectLocalContext(
  resultId: string, 
  nodes: Node[], 
  edges: Edge[]
): { prompts: string[]; medias: string[] } {
  const inputEdges = edges.filter(e => e.target === resultId);
  
  // Local prompts (not from gravity)
  const localPrompts = inputEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'prompt'))
    .filter(Boolean)
    .map(n => (n!.data as { value?: string }).value)
    .filter(Boolean) as string[];
  
  // Local medias (not from gravity)
  const localMedias = inputEdges
    .map(e => nodes.find(n => n.id === e.source && n.type === 'media'))
    .filter(Boolean)
    .map(n => (n!.data as { url?: string | null }).url)
    .filter(Boolean) as string[];
  
  return { prompts: localPrompts, medias: localMedias };
}

function EditorCanvas({ projectId }: EditorCanvasProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [projectName, setProjectName] = useState('Sem título');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const toastRef = useRef(toast);
  const setNodesRef = useRef(setNodes);
  const pollingFallbackRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedAtRef = useRef<string>('');
  const activeResultIdsRef = useRef<Set<string>>(new Set());
  const pendingJobsRef = useRef<{ id: string; quantity: number; resultId?: string }[]>([]);

  // Keep refs in sync
  useEffect(() => {
    toastRef.current = toast;
    setNodesRef.current = setNodes;
  }, [toast, setNodes]);

  // Job completed handler - add images to the SPECIFIC result/output node that started the job
  const handleJobCompleted = useCallback((result: { jobId: string; resultUrls: string[]; resultCount: number; resultId?: string }) => {
    const currentNodes = nodesRef.current;
    
    // Use resultId from the job to find the correct target node
    let targetNode: Node | undefined;
    
    if (result.resultId) {
      targetNode = currentNodes.find((n) => n.id === result.resultId);
    }
    
    // Fallback for legacy jobs without resultId
    if (!targetNode) {
      targetNode = currentNodes.find((n) => n.type === 'result');
      if (!targetNode) {
        targetNode = currentNodes.find((n) => n.type === 'output');
      }
    }
    
    if (!targetNode) return;

    // Validate resultUrls before use
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

    const targetId = targetNode.id;

    setNodesRef.current((nds) => {
      return nds.map((n) => {
        if (n.id === targetId) {
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

    // Detect partial failure: compare requested quantity vs delivered
    const pendingJob = pendingJobsRef.current.find(j => j.id === result.jobId);
    const requestedQty = pendingJob?.quantity || result.resultCount;
    const failedCount = requestedQty - result.resultCount;

    if (failedCount > 0) {
      toastRef.current({
        title: `${result.resultCount} de ${requestedQty} imagens geradas`,
        description: `${failedCount} ${failedCount === 1 ? 'crédito reembolsado' : 'créditos reembolsados'}.`,
      });
    } else {
      toastRef.current({ 
        title: `${result.resultCount} ${result.resultCount === 1 ? 'imagem gerada' : 'imagens geradas'} com sucesso!` 
      });
    }
    
    refreshProfile();
  }, [refreshProfile]);

  // Job failed handler
  const handleJobFailed = useCallback((jobId: string, error: string) => {
    toastRef.current({
      title: 'Falha na geração',
      description: error,
      variant: 'destructive'
    });
    
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

  // Keep pendingJobsRef in sync
  useEffect(() => {
    pendingJobsRef.current = pendingJobs;
  }, [pendingJobs]);

  // Dispatch job queue state to SettingsNode (legacy)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(JOB_QUEUE_STATE_EVENT, { 
      detail: { hasQueuedJobs, hasProcessingJobs, totalPendingImages } 
    }));
  }, [hasQueuedJobs, hasProcessingJobs, totalPendingImages]);

  // NEW: Dispatch job queue state events per resultId for ResultNode
  useEffect(() => {
    // Group jobs by resultId
    const jobsByResult = new Map<string, typeof pendingJobs>();
    
    for (const job of pendingJobs) {
      if (job.resultId) {
        const jobs = jobsByResult.get(job.resultId) || [];
        jobs.push(job);
        jobsByResult.set(job.resultId, jobs);
      }
    }
    
    // Track which resultIds currently have jobs
    const currentActiveIds = new Set(jobsByResult.keys());
    
    // Clear state for resultIds that no longer have pending jobs
    for (const prevResultId of activeResultIdsRef.current) {
      if (!currentActiveIds.has(prevResultId)) {
        // Reset job queue state
        window.dispatchEvent(new CustomEvent(RESULT_JOB_QUEUE_STATE_EVENT, {
          detail: { 
            resultId: prevResultId, 
            hasQueuedJobs: false, 
            hasProcessingJobs: false, 
            totalPendingImages: 0 
          }
        }));
        // Also reset generating state (important: this was missing!)
        window.dispatchEvent(new CustomEvent(RESULT_GENERATING_STATE_EVENT, {
          detail: { resultId: prevResultId, isGenerating: false }
        }));
      }
    }
    
    // Dispatch event for each resultId with active jobs
    for (const [resultId, jobs] of jobsByResult) {
      const hasQueuedJobsForResult = jobs.some(j => j.status === 'queued');
      const hasProcessingJobsForResult = jobs.some(j => j.status === 'processing');
      const totalPendingImagesForResult = jobs.reduce((acc, j) => acc + j.quantity, 0);
      
      window.dispatchEvent(new CustomEvent(RESULT_JOB_QUEUE_STATE_EVENT, {
        detail: { 
          resultId, 
          hasQueuedJobs: hasQueuedJobsForResult, 
          hasProcessingJobs: hasProcessingJobsForResult, 
          totalPendingImages: totalPendingImagesForResult 
        }
      }));
    }
    
    // Update the ref for next comparison
    activeResultIdsRef.current = currentActiveIds;
  }, [pendingJobs]);

  // Load project and populate output/result node with images from generations table
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        setIsLoading(false);
        return;
      }
      try {
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
          
          const needsRepair = needsAutoRepair(canvasState);
          
          let loadedNodes = canvasState?.nodes || [];
          let loadedEdges = canvasState?.edges || [];
          
          if (needsRepair) {
            console.log('Auto-repair triggered: sanitizing canvas_state');
            const repaired = repairCanvasState(canvasState);
            loadedNodes = repaired.nodes;
            loadedEdges = repaired.edges;
            
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
                description: 'Removemos imagens antigas do canvas para melhorar a performance.',
              });
              lastSavedDataRef.current = JSON.stringify(cleanState);
            }
          }
          
          // Load historical images from generations table WITH result_node_id
          const { data: generations } = await supabase
            .from('generations')
            .select('image_url, prompt, aspect_ratio, created_at, result_node_id')
            .eq('project_id', projectId)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(200);
          
          // Group images by result_node_id for isolated display per node
          if (generations && generations.length > 0) {
            type NodeImage = {
              url: string | null;
              prompt: string;
              aspectRatio: string;
              savedToGallery: boolean;
              generatedAt: string;
            };
            
            const imagesByNode = new Map<string, NodeImage[]>();
            
            generations.forEach(gen => {
              const nodeId = (gen as { result_node_id?: string | null }).result_node_id || '__shared__';
              const existing = imagesByNode.get(nodeId) || [];
              existing.push({
                url: gen.image_url,
                prompt: gen.prompt,
                aspectRatio: gen.aspect_ratio,
                savedToGallery: true,
                generatedAt: gen.created_at,
              });
              imagesByNode.set(nodeId, existing);
            });
            
            // Legacy images (without result_node_id) go to the first Result Node
            const sharedImages = imagesByNode.get('__shared__') || [];
            const resultNodes = loadedNodes.filter(n => n.type === 'result');
            
            loadedNodes = loadedNodes.map(node => {
              if (node.type === 'result') {
                const nodeImages = imagesByNode.get(node.id) || [];
                const isFirstResult = resultNodes.length > 0 && resultNodes[0].id === node.id;
                // First Result Node gets legacy images too; reverse for chronological display
                const finalImages = isFirstResult 
                  ? [...nodeImages, ...sharedImages].reverse()
                  : nodeImages.reverse();
                return {
                  ...node,
                  data: {
                    ...node.data,
                    images: finalImages,
                  },
                };
              }
              // Legacy output nodes also get shared images
              if (node.type === 'output') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    images: sharedImages.reverse(),
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

  // Save function with sanitization
  const saveProject = useCallback(async (nodesToSave: Node[], edgesToSave: Edge[]) => {
    if (!projectId || !user || isLoading) return;
    
    const cleanState = sanitizeCanvasState(nodesToSave, edgesToSave);

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
  
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // NEW: Generate for a specific Result node
  const generateForResult = useCallback(async (resultId: string) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
    const resultNode = currentNodes.find(n => n.id === resultId && n.type === 'result');
    if (!resultNode) {
      toast({
        title: 'Erro',
        description: 'Node de resultado não encontrado.',
        variant: 'destructive'
      });
      return;
    }

    const resultData = resultNode.data as unknown as ResultNodeData;
    const quantity = resultData.quantity || 1;
    const aspectRatio = resultData.aspectRatio || '1:1';
    const creditsNeeded = quantity;

    if (!profile || profile.credits < creditsNeeded) {
      setShowBuyCredits(true);
      return;
    }

    // Check if connected to a Gravity
    const gravityId = findConnectedGravity(resultId, currentNodes, currentEdges);
    
    // Collect context
    let allPrompts: string[] = [];
    let allMedias: string[] = [];
    
    if (gravityId) {
      const gravityContext = collectGravityContext(gravityId, currentNodes, currentEdges);
      allPrompts = [...gravityContext.prompts];
      allMedias = [...gravityContext.medias];
    }
    
    // Add local context
    const localContext = collectLocalContext(resultId, currentNodes, currentEdges);
    allPrompts = [...allPrompts, ...localContext.prompts];
    allMedias = [...allMedias, ...localContext.medias];

    if (allPrompts.length === 0) {
      toast({
        title: 'Adicione um prompt',
        description: 'Conecte pelo menos um nó de prompt ao Resultado ou ao Gravity.',
        variant: 'destructive'
      });
      return;
    }

    const prompt = allPrompts.join(' ');
    
    // Dispatch generating state
    window.dispatchEvent(new CustomEvent(RESULT_GENERATING_STATE_EVENT, { 
      detail: { resultId, isGenerating: true } 
    }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, aspectRatio, quantity, imageUrls: allMedias, projectId, resultId }
      });

      if (error) {
        let errorMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const errBody = await error.context?.json();
            errorMsg = errBody?.error || errorMsg;
          } catch { /* ignore parse errors */ }
        }
        throw new Error(errorMsg);
      }

      // Add job with resultId so we know where to deliver images
      addPendingJob(data.jobId, data.quantity, resultId);
      
      // DON'T set isGenerating to false here - let job queue state control the UI
      // The ResultNode listens to RESULT_JOB_QUEUE_STATE_EVENT for its state

      toast({ 
        title: 'Geração iniciada',
        description: `${quantity} ${quantity === 1 ? 'imagem está sendo gerada' : 'imagens estão sendo geradas'}...`
      });

      refreshProfile();
      
    } catch (error) {
      console.error('Generation error:', error);
      window.dispatchEvent(new CustomEvent(RESULT_GENERATING_STATE_EVENT, { 
        detail: { resultId, isGenerating: false } 
      }));
      toast({
        title: 'Erro na geração',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  }, [profile, projectId, toast, addPendingJob, refreshProfile]);

  // NEW: Generate all Results connected to a Gravity
  const generateAllFromGravity = useCallback(async (gravityId: string) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    
    // Find all Result nodes connected to this Gravity
    const outputEdges = currentEdges.filter(e => e.source === gravityId);
    const connectedResults = outputEdges
      .map(e => currentNodes.find(n => n.id === e.target && n.type === 'result'))
      .filter(Boolean) as Node[];

    if (connectedResults.length === 0) {
      toast({
        title: 'Nenhum Resultado conectado',
        description: 'Conecte pelo menos um nó de Resultado ao Gravity.',
        variant: 'destructive'
      });
      return;
    }

    // Dispatch generating state to Gravity
    window.dispatchEvent(new CustomEvent(GRAVITY_GENERATING_STATE_EVENT, { 
      detail: { 
        gravityId, 
        isGenerating: true, 
        totalResults: connectedResults.length,
        completedResults: 0 
      } 
    }));

    let completed = 0;

    // Generate for each Result sequentially (to avoid overwhelming the API)
    for (const resultNode of connectedResults) {
      await generateForResult(resultNode.id);
      completed++;
      
      window.dispatchEvent(new CustomEvent(GRAVITY_GENERATING_STATE_EVENT, { 
        detail: { 
          gravityId, 
          isGenerating: completed < connectedResults.length, 
          totalResults: connectedResults.length,
          completedResults: completed 
        } 
      }));
    }

  }, [toast, generateForResult]);

  // Listen for Result generate events
  useEffect(() => {
    const handler = (e: CustomEvent<{ resultId: string }>) => {
      generateForResult(e.detail.resultId);
    };
    
    window.addEventListener(GENERATE_FOR_RESULT_EVENT, handler as EventListener);
    return () => window.removeEventListener(GENERATE_FOR_RESULT_EVENT, handler as EventListener);
  }, [generateForResult]);

  // Listen for Gravity generate all events
  useEffect(() => {
    const handler = (e: CustomEvent<{ gravityId: string }>) => {
      generateAllFromGravity(e.detail.gravityId);
    };
    
    window.addEventListener(GENERATE_ALL_FROM_GRAVITY_EVENT, handler as EventListener);
    return () => window.removeEventListener(GENERATE_ALL_FROM_GRAVITY_EVENT, handler as EventListener);
  }, [generateAllFromGravity]);

  // Legacy: handleGenerate for old Settings node
  const handleGenerate = useCallback(async () => {
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
    const creditsNeeded = quantity;

    if (!profile || profile.credits < creditsNeeded) {
      setShowBuyCredits(true);
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

    window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: true } }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, aspectRatio, quantity, imageUrls, projectId }
      });

      if (error) {
        let errorMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const errBody = await error.context?.json();
            errorMsg = errBody?.error || errorMsg;
          } catch { /* ignore parse errors */ }
        }
        throw new Error(errorMsg);
      }

      addPendingJob(data.jobId, data.quantity);
      window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: false } }));

      toast({ 
        title: 'Geração iniciada',
        description: `${quantity} ${quantity === 1 ? 'imagem está sendo gerada' : 'imagens estão sendo geradas'}...`
      });

      refreshProfile();
      
    } catch (error) {
      console.error('Generation error:', error);
      window.dispatchEvent(new CustomEvent(GENERATING_STATE_EVENT, { detail: { isGenerating: false } }));
      toast({
        title: 'Erro na geração',
        description: (error as Error).message,
        variant: 'destructive'
      });
    }
  }, [profile, projectId, toast, addPendingJob, refreshProfile]);

  // Listen for generate events from SettingsNode (legacy)
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
        const { data: generations, error } = await supabase
          .from('generations')
          .select('image_url, prompt, aspect_ratio, created_at, result_node_id')
          .eq('project_id', projectId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error || !generations) return;

        const newestCreatedAt = generations[0]?.created_at || '';
        if (newestCreatedAt && newestCreatedAt !== lastSyncedAtRef.current) {
          console.log('Polling fallback: detected new images, syncing by node...');
          lastSyncedAtRef.current = newestCreatedAt;

          // Group images by result_node_id (same logic as initial load)
          type NodeImage = {
            url: string | null;
            prompt: string;
            aspectRatio: string;
            savedToGallery: boolean;
            generatedAt: string;
          };
          
          const imagesByNode = new Map<string, NodeImage[]>();
          
          generations.forEach(gen => {
            const nodeId = (gen as { result_node_id?: string | null }).result_node_id || '__shared__';
            const existing = imagesByNode.get(nodeId) || [];
            existing.push({
              url: gen.image_url,
              prompt: gen.prompt,
              aspectRatio: gen.aspect_ratio,
              savedToGallery: true,
              generatedAt: gen.created_at,
            });
            imagesByNode.set(nodeId, existing);
          });
          
          const sharedImages = imagesByNode.get('__shared__') || [];

          setNodesRef.current((nds) => {
            const resultNodes = nds.filter(n => n.type === 'result');
            
            return nds.map((n) => {
              if (n.type === 'result') {
                const nodeImages = imagesByNode.get(n.id) || [];
                const isFirstResult = resultNodes.length > 0 && resultNodes[0].id === n.id;
                // First Result Node gets legacy images too; slice().reverse() to avoid mutation
                const finalImages = isFirstResult 
                  ? [...nodeImages, ...sharedImages].slice().reverse()
                  : nodeImages.slice().reverse();
                return {
                  ...n,
                  data: {
                    ...n.data,
                    images: finalImages,
                  },
                };
              }
              // Legacy output nodes only get shared images
              if (n.type === 'output') {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    images: sharedImages.slice().reverse(),
                  },
                };
              }
              return n;
            });
          });
        }
      } catch (err) {
        console.error('Polling fallback error:', err);
      }
    };

    const initialTimeout = setTimeout(checkForNewImages, 2000);
    pollingFallbackRef.current = setInterval(checkForNewImages, 5000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingFallbackRef.current) {
        clearInterval(pollingFallbackRef.current);
        pollingFallbackRef.current = null;
      }
    };
  }, [projectId, pendingJobs.length]);

  // Clipboard ref for copy/paste
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // Copy/Paste keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          const selectedNodes = nodesRef.current.filter(n => n.selected);
          if (selectedNodes.length === 0) return;

          const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
          const connectedEdges = edgesRef.current.filter(
            e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
          );

          clipboardRef.current = {
            nodes: selectedNodes.map(n => ({ ...n, data: { ...n.data } })),
            edges: connectedEdges.map(e => ({ ...e }))
          };

          toastRef.current({ title: `${selectedNodes.length} nó${selectedNodes.length > 1 ? 's' : ''} copiado${selectedNodes.length > 1 ? 's' : ''}` });
        }

        if (e.key === 'v') {
          if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return;

          const { nodes: copiedNodes, edges: copiedEdges } = clipboardRef.current;
          const timestamp = Date.now();
          const idMap = new Map<string, string>();

          const newNodes = copiedNodes.map((node, index) => {
            const newId = `${node.type}-${timestamp}-${index}`;
            idMap.set(node.id, newId);
            return {
              ...node,
              id: newId,
              position: {
                x: node.position.x + 50,
                y: node.position.y + 50
              },
              selected: false,
              data: { ...node.data }
            };
          });

          const newEdges = copiedEdges.map((edge, index) => ({
            ...edge,
            id: `edge-${timestamp}-${index}`,
            source: idMap.get(edge.source) || edge.source,
            target: idMap.get(edge.target) || edge.target
          }));

          setNodes(nds => [...nds, ...newNodes]);
          setEdges(eds => [...eds, ...newEdges]);

          toastRef.current({ title: `${newNodes.length} nó${newNodes.length > 1 ? 's' : ''} colado${newNodes.length > 1 ? 's' : ''}` });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setNodes, setEdges]);

  const addNode = useCallback(
    (type: string) => {
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
    [setNodes]
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
          deleteKeyCode={['Backspace', 'Delete']}
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
      <BuyCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />
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
