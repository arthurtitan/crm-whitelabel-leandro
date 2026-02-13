import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify user identity with their token
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check super_admin role using service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch all KPIs in parallel
    const [
      accountsRes,
      activeAccountsRes,
      pausedAccountsRes,
      usersRes,
      activeUsersRes,
      contactsRes,
      paidSalesRes,
    ] = await Promise.all([
      adminClient.from('accounts').select('id', { count: 'exact', head: true }),
      adminClient.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      adminClient.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'paused'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      adminClient.from('contacts').select('id', { count: 'exact', head: true }),
      adminClient.from('sales').select('valor', { count: 'exact' }).eq('status', 'paid'),
    ])

    const totalRevenue = (paidSalesRes.data || []).reduce((sum: number, s: any) => sum + (s.valor || 0), 0)

    const kpis = {
      totalAccounts: accountsRes.count ?? 0,
      activeAccounts: activeAccountsRes.count ?? 0,
      pausedAccounts: pausedAccountsRes.count ?? 0,
      totalUsers: usersRes.count ?? 0,
      activeUsers: activeUsersRes.count ?? 0,
      totalContacts: contactsRes.count ?? 0,
      totalPaidSales: paidSalesRes.count ?? 0,
      totalRevenue,
    }

    return new Response(JSON.stringify(kpis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
