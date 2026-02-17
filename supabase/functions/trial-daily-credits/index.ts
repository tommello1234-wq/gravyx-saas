import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Fetch all trial_active users with trial_credits_given < 35
    const { data: trialUsers, error: fetchError } = await supabase
      .from('profiles')
      .select('user_id, trial_start_date, trial_credits_given, credits')
      .eq('subscription_status', 'trial_active')
      .lt('trial_credits_given', 35);

    if (fetchError) {
      console.error('Error fetching trial users:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!trialUsers || trialUsers.length === 0) {
      console.log('No trial users to process');
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let expired = 0;

    for (const user of trialUsers) {
      const trialStart = new Date(user.trial_start_date);
      const now = new Date();
      const daysPassed = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));

      // Trial expired (> 7 days)
      if (daysPassed >= 7) {
        await supabase
          .from('profiles')
          .update({ subscription_status: 'inactive' })
          .eq('user_id', user.user_id);
        expired++;
        console.log(`Trial expired for user ${user.user_id}`);
        continue;
      }

      // Calculate expected credits: (daysPassed + 1) * 5, max 35
      const expectedCredits = Math.min(35, (daysPassed + 1) * 5);
      const creditsToGive = expectedCredits - user.trial_credits_given;

      if (creditsToGive > 0) {
        await supabase
          .from('profiles')
          .update({
            credits: user.credits + creditsToGive,
            trial_credits_given: expectedCredits,
          })
          .eq('user_id', user.user_id);
        processed++;
        console.log(`Granted ${creditsToGive} trial credits to user ${user.user_id} (total: ${expectedCredits})`);
      }
    }

    console.log(`Trial credits processed: ${processed} granted, ${expired} expired`);
    return new Response(JSON.stringify({ processed, expired }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
