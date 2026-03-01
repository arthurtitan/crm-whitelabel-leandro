import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fix ai_participated on inferred records
    const { data: fixedRows, error: fixError } = await supabase
      .from('resolution_logs')
      .update({ ai_participated: false })
      .eq('resolution_type', 'inferred')
      .eq('ai_participated', true)
      .select('id');

    if (fixError) throw fixError;
    const fixedCount = fixedRows?.length || 0;

    // Step 2: Get all records to find duplicates
    const { data: allLogs, error: fetchError } = await supabase
      .from('resolution_logs')
      .select('id, account_id, conversation_id, created_at')
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    // Find duplicates: keep most recent per (account_id, conversation_id)
    const seen = new Map<string, string>();
    const toDelete: string[] = [];

    for (const log of allLogs || []) {
      const key = `${log.account_id}:${log.conversation_id}`;
      if (seen.has(key)) {
        toDelete.push(log.id);
      } else {
        seen.set(key, log.id);
      }
    }

    // Delete duplicates in batches
    let deletedCount = 0;
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50);
      const { error: delError } = await supabase
        .from('resolution_logs')
        .delete()
        .in('id', batch);
      if (delError) throw delError;
      deletedCount += batch.length;
    }

    // Step 3: Verify final state
    const { data: remaining } = await supabase
      .from('resolution_logs')
      .select('id, account_id, conversation_id, resolved_by, resolution_type, ai_participated');

    return new Response(
      JSON.stringify({
        success: true,
        fixed_ai_participated: fixedCount,
        duplicates_deleted: deletedCount,
        remaining_records: remaining?.length || 0,
        records: remaining,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

