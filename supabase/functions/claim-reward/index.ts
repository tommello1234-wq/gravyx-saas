import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MISSION_REWARDS: Record<number, { credits: number; badgeId?: string }> = {
  1: { credits: 5 },
  2: { credits: 5 },
  3: { credits: 5 },
  4: { credits: 0, badgeId: 'gravity_explorer' },
  5: { credits: 10 },
  6: { credits: 10 },
  7: { credits: 15, badgeId: '7day_challenger' },
  8: { credits: 0, badgeId: 'flow_builder' },
  9: { credits: 20 },
  10: { credits: 0, badgeId: 'journey_complete' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client to get user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { day_number } = await req.json();
    if (!day_number || day_number < 1 || day_number > 10) {
      throw new Error('Invalid day_number');
    }

    const reward = MISSION_REWARDS[day_number];
    if (!reward) throw new Error('Invalid mission');

    // Service role client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Check if already claimed
    const { data: existing } = await adminClient
      .from('user_missions')
      .select('reward_claimed')
      .eq('user_id', user.id)
      .eq('day_number', day_number)
      .maybeSingle();

    if (existing?.reward_claimed) {
      return new Response(JSON.stringify({ error: 'Already claimed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Verify mission completion based on day
    const completed = await verifyMission(adminClient, user.id, day_number);
    if (!completed) {
      return new Response(JSON.stringify({ error: 'Mission not completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Upsert mission as completed + claimed
    await adminClient.from('user_missions').upsert({
      user_id: user.id,
      day_number,
      completed: true,
      reward_claimed: true,
      completed_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day_number' });

    // Grant credits
    if (reward.credits > 0) {
      await adminClient.rpc('increment_credits', { uid: user.id, amount: reward.credits });
    }

    // Grant badge
    if (reward.badgeId) {
      await adminClient.from('user_badges').upsert({
        user_id: user.id,
        badge_id: reward.badgeId,
        earned_at: new Date().toISOString(),
      }, { onConflict: 'user_id,badge_id' });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      credits_awarded: reward.credits,
      badge_awarded: reward.badgeId || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

async function verifyMission(client: any, userId: string, day: number): Promise<boolean> {
  switch (day) {
    case 1: {
      const { count } = await client.from('generations').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'completed');
      return (count ?? 0) >= 1;
    }
    case 2: {
      const { count } = await client.from('projects').select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (count ?? 0) >= 2;
    }
    case 3: {
      // Check if user has at least 1 project (template usage is assumed if they used "create from template")
      const { count } = await client.from('projects').select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (count ?? 0) >= 1;
    }
    case 4: {
      const { data: projects } = await client.from('projects').select('canvas_state').eq('user_id', userId);
      return (projects ?? []).some((p: any) => {
        const cs = p.canvas_state;
        return cs?.nodes?.some((n: any) => n.type === 'gravity');
      });
    }
    case 5: {
      const { data: projects } = await client.from('projects').select('canvas_state').eq('user_id', userId);
      return (projects ?? []).some((p: any) => {
        const cs = p.canvas_state;
        const resultNodes = (cs?.nodes ?? []).filter((n: any) => n.type === 'result');
        return resultNodes.length >= 2;
      });
    }
    case 6: {
      const { data: projects } = await client.from('projects').select('created_at, updated_at').eq('user_id', userId);
      return (projects ?? []).some((p: any) => {
        const created = new Date(p.created_at).getTime();
        const updated = new Date(p.updated_at).getTime();
        return (updated - created) > 60000; // 1 minute
      });
    }
    case 7: {
      const { data: projects } = await client.from('projects').select('canvas_state').eq('user_id', userId);
      return (projects ?? []).some((p: any) => {
        const cs = p.canvas_state;
        const types = new Set((cs?.nodes ?? []).map((n: any) => n.type));
        return types.has('prompt') && types.has('media') && types.has('result');
      });
    }
    case 8: {
      const { data: projects } = await client.from('projects').select('canvas_state').eq('user_id', userId);
      return (projects ?? []).some((p: any) => {
        const cs = p.canvas_state;
        const resultNodes = (cs?.nodes ?? []).filter((n: any) => n.type === 'result');
        if (resultNodes.length < 2) return false;
        const resultIds = new Set(resultNodes.map((n: any) => n.id));
        return (cs?.edges ?? []).some((e: any) => resultIds.has(e.target) || resultIds.has(e.source));
      });
    }
    case 9: {
      const { data: projects } = await client.from('projects').select('id').eq('user_id', userId);
      for (const proj of (projects ?? [])) {
        const { count } = await client.from('generations').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('project_id', proj.id).eq('status', 'completed');
        if ((count ?? 0) >= 2) return true;
      }
      return false;
    }
    case 10: {
      // Just being active on day 10+
      const { data: journey } = await client.from('user_journey').select('journey_start_date')
        .eq('user_id', userId).maybeSingle();
      if (!journey?.journey_start_date) return false;
      const start = new Date(journey.journey_start_date);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diffDays >= 10;
    }
    default:
      return false;
  }
}
