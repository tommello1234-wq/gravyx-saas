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
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();

  // On mount, fetch any existing pending jobs from the database to restore state
  useEffect(() => {
    if (!projectId || initialized) return;

    const fetchPendingJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, status, payload')
          .eq('project_id', projectId)
          .in('status', ['queued', 'processing']);

        if (error) {
          console.error('[useJobQueue] Error fetching pending jobs:', error);
          return;
        }

        if (data && data.length > 0) {
          console.log('[useJobQueue] Restoring', data.length, 'pending jobs from database');
          const restoredJobs: PendingJob[] = data.map((job) => ({
            id: job.id,
            status: job.status as 'queued' | 'processing',
            quantity: (job.payload as { quantity?: number })?.quantity || 1,
            createdAt: new Date().toISOString()
          }));
          setPendingJobs(restoredJobs);
        }
      } catch (err) {
        console.error('[useJobQueue] Exception fetching pending jobs:', err);
      } finally {
        setInitialized(true);
      }
    };

    fetchPendingJobs();
  }, [projectId, initialized]);

  // Polling that triggers the worker execution (keeps the queue moving)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling that reconciles job statuses (fallback when Realtime misses/out-of-order updates)
  const statusPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const callbacksRef = useRef({ onJobCompleted, onJobFailed });

  // Tracks jobs we've already processed to avoid duplicates AND to handle out-of-order events
  // (e.g. job completes before it was added to pendingJobs)
  const processedJobIdsRef = useRef<Set<string>>(new Set());

  // Keep callbacks ref in sync
  useEffect(() => {
    callbacksRef.current = { onJobCompleted, onJobFailed };
  }, [onJobCompleted, onJobFailed]);

  // Add a new job to the pending list
  const addPendingJob = useCallback((jobId: string, quantity: number) => {
    // If the job already completed/failed (Realtime can arrive before state updates), don't add it.
    if (processedJobIdsRef.current.has(jobId)) {
      console.log('[useJobQueue] Skipping addPendingJob for already-processed job:', jobId);
      return;
    }

    setPendingJobs((prev) => [
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
    setPendingJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  // Update job status
  const updateJobStatus = useCallback((jobId: string, status: PendingJob['status']) => {
    setPendingJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status } : job)));
  }, []);

  const processJobUpdate = useCallback((job: {
    id: string;
    status: string;
    result_urls: string[] | null;
    result_count: number | null;
    error: string | null;
  }) => {
    if (!job?.id) return;

    // Prevent duplicate processing (Realtime + polling can both see the same completion)
    if (processedJobIdsRef.current.has(job.id)) return;

    console.log('[useJobQueue] Processing job update:', job.id, 'status:', job.status);

    if (job.status === 'completed') {
      const urls = job.result_urls;

      if (Array.isArray(urls) && urls.length > 0) {
        console.log('[useJobQueue] Job completed with', urls.length, 'images');
        callbacksRef.current.onJobCompleted({
          jobId: job.id,
          resultUrls: urls,
          resultCount: job.result_count || urls.length
        });
      } else {
        console.error('[useJobQueue] Job completed WITHOUT valid result_urls:', job.id, 'urls:', urls);
        callbacksRef.current.onJobFailed(job.id, 'Job concluído sem imagens');
      }

      processedJobIdsRef.current.add(job.id);
      // Unconditional removal: safe even if not present; fixes out-of-order state updates
      removePendingJob(job.id);
    } else if (job.status === 'failed') {
      console.error('[useJobQueue] Job failed:', job.id, job.error);
      callbacksRef.current.onJobFailed(job.id, job.error || 'Falha na geração');

      processedJobIdsRef.current.add(job.id);
      removePendingJob(job.id);
    } else if (job.status === 'processing') {
      updateJobStatus(job.id, 'processing');
    }
  }, [removePendingJob, updateJobStatus]);

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
    pendingJobIdsRef.current = new Set(pendingJobs.map((j) => j.id));
  }, [pendingJobs]);

  // Subscribe to Realtime updates for jobs - always active when projectId exists
  useEffect(() => {
    if (!projectId) return;

    console.log('[useJobQueue] Setting up Realtime subscription for project:', projectId);

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

          console.log('[useJobQueue] Realtime job update received:', job.id, 'status:', job.status);
          processJobUpdate(job);
        }
      )
      .subscribe((status, err) => {
        console.log('[useJobQueue] Realtime subscription status:', status);
        if (err) {
          console.error('[useJobQueue] Realtime subscription error:', err);
        }
      });

    return () => {
      console.log('[useJobQueue] Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [projectId, processJobUpdate]);

  // Fallback: poll job statuses to reconcile pendingJobs when Realtime misses/out-of-order updates
  useEffect(() => {
    if (!projectId) return;

    if (pendingJobs.length === 0) {
      if (statusPollingIntervalRef.current) {
        clearInterval(statusPollingIntervalRef.current);
        statusPollingIntervalRef.current = null;
      }
      return;
    }

    const pollStatuses = async () => {
      const ids = Array.from(pendingJobIdsRef.current);
      if (ids.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id,status,result_urls,result_count,error')
          .in('id', ids);

        if (error) {
          console.error('[useJobQueue] Status polling error:', error.message || error);
          return;
        }

        (data ?? []).forEach((row) => processJobUpdate(row as any));
      } catch (err) {
        console.error('[useJobQueue] Status polling exception:', err);
      }
    };

    // Initial reconciliation
    pollStatuses();

    statusPollingIntervalRef.current = setInterval(pollStatuses, 5000);

    return () => {
      if (statusPollingIntervalRef.current) {
        clearInterval(statusPollingIntervalRef.current);
        statusPollingIntervalRef.current = null;
      }
    };
  }, [projectId, pendingJobs.length, processJobUpdate]);

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
