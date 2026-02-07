import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  quantity: number;
  createdAt: string;
}

interface JobResult {
  jobId: string;
  resultUrls: string[];
  resultCount: number;
}

interface UseJobQueueOptions {
  projectId: string | null;
  onJobCompleted: (result: JobResult) => void;
  onJobFailed: (jobId: string, error: string) => void;
}

export function useJobQueue({ projectId, onJobCompleted, onJobFailed }: UseJobQueueOptions) {
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const { toast } = useToast();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbacksRef = useRef({ onJobCompleted, onJobFailed });

  // Keep callbacks ref in sync
  useEffect(() => {
    callbacksRef.current = { onJobCompleted, onJobFailed };
  }, [onJobCompleted, onJobFailed]);

  // Add a new job to the pending list
  const addPendingJob = useCallback((jobId: string, quantity: number) => {
    setPendingJobs(prev => [
      ...prev,
      {
        id: jobId,
        status: 'queued',
        quantity,
        createdAt: new Date().toISOString()
      }
    ]);
  }, []);

  // Remove a job from the pending list
  const removePendingJob = useCallback((jobId: string) => {
    setPendingJobs(prev => prev.filter(job => job.id !== jobId));
  }, []);

  // Update job status
  const updateJobStatus = useCallback((jobId: string, status: PendingJob['status']) => {
    setPendingJobs(prev => 
      prev.map(job => job.id === jobId ? { ...job, status } : job)
    );
  }, []);

  // Poll the worker to process jobs
  const pollWorker = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('image-worker');
      if (error) {
        console.error('Worker invocation error:', error.message || error);
      }
    } catch (error) {
      console.error('Worker poll exception:', error);
    }
  }, []);

  // Start polling when there are pending jobs
  useEffect(() => {
    if (pendingJobs.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    
    // Initial poll
    pollWorker();
    
    // Poll every 3 seconds
    pollingIntervalRef.current = setInterval(pollWorker, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pendingJobs.length, pollWorker]);

  // Track pending job IDs for checking in callbacks
  const pendingJobIdsRef = useRef<Set<string>>(new Set());
  
  // Keep pendingJobIdsRef in sync
  useEffect(() => {
    pendingJobIdsRef.current = new Set(pendingJobs.map(j => j.id));
  }, [pendingJobs]);

  // Subscribe to Realtime updates for jobs - always active when projectId exists
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`jobs-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          const job = payload.new as {
            id: string;
            status: string;
            result_urls: string[] | null;
            result_count: number | null;
            error: string | null;
          };

          console.log('Job update received:', job.id, job.status);

          if (job.status === 'completed') {
            // CORREÇÃO: Validar que result_urls é um array não vazio antes de chamar callback
            const urls = job.result_urls;
            if (Array.isArray(urls) && urls.length > 0) {
              callbacksRef.current.onJobCompleted({
                jobId: job.id,
                resultUrls: urls,
                resultCount: job.result_count || urls.length
              });
            } else {
              console.error('Job completed without valid result_urls:', job.id, 'urls:', urls);
            }
            // Only remove if it was in our pending list
            if (pendingJobIdsRef.current.has(job.id)) {
              removePendingJob(job.id);
            }
          } else if (job.status === 'failed') {
            callbacksRef.current.onJobFailed(job.id, job.error || 'Falha na geração');
            if (pendingJobIdsRef.current.has(job.id)) {
              removePendingJob(job.id);
            }
          } else if (job.status === 'processing') {
            updateJobStatus(job.id, 'processing');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, removePendingJob, updateJobStatus]);

  // Computed states
  const hasQueuedJobs = pendingJobs.some(job => job.status === 'queued');
  const hasProcessingJobs = pendingJobs.some(job => job.status === 'processing');
  const totalPendingImages = pendingJobs.reduce((acc, job) => acc + job.quantity, 0);

  return {
    pendingJobs,
    addPendingJob,
    removePendingJob,
    isPolling,
    hasQueuedJobs,
    hasProcessingJobs,
    totalPendingImages
  };
}
