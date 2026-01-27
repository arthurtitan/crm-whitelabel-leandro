import { supabase } from '@/integrations/supabase/client';

export interface Account {
  id: string;
  nome: string;
  status: 'active' | 'paused' | 'cancelled';
  timezone: string;
  plano: string | null;
  limite_usuarios: number;
  chatwoot_base_url: string | null;
  chatwoot_account_id: string | null;
  chatwoot_api_key: string | null;
  created_at: string;
  updated_at: string;
  users_count?: number;
}

export interface CreateAccountInput {
  nome: string;
  plano?: string;
  chatwoot_base_url?: string;
  chatwoot_account_id?: string;
  chatwoot_api_key?: string;
}

export interface UpdateAccountInput {
  nome?: string;
  status?: 'active' | 'paused' | 'cancelled';
  plano?: string;
  chatwoot_base_url?: string;
  chatwoot_account_id?: string;
  chatwoot_api_key?: string;
}

export const accountsCloudService = {
  /**
   * List all accounts (Super Admin only)
   */
  async list(): Promise<Account[]> {
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      throw new Error(error.message);
    }

    // Get user count for each account
    const accountsWithCount = await Promise.all(
      (accounts || []).map(async (account) => {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', account.id);

        return {
          ...account,
          status: account.status as 'active' | 'paused' | 'cancelled',
          users_count: count || 0,
        };
      })
    );

    return accountsWithCount;
  },

  /**
   * Get account by ID
   */
  async getById(id: string): Promise<Account | null> {
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching account:', error);
      throw new Error(error.message);
    }

    if (!account) return null;

    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', account.id);

    return {
      ...account,
      status: account.status as 'active' | 'paused' | 'cancelled',
      users_count: count || 0,
    };
  },

  /**
   * Create a new account
   */
  async create(input: CreateAccountInput): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        nome: input.nome,
        plano: input.plano,
        chatwoot_base_url: input.chatwoot_base_url,
        chatwoot_account_id: input.chatwoot_account_id,
        chatwoot_api_key: input.chatwoot_api_key,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      throw new Error(error.message);
    }

    return {
      ...data,
      status: data.status as 'active' | 'paused' | 'cancelled',
      users_count: 0,
    };
  },

  /**
   * Update an account
   */
  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating account:', error);
      throw new Error(error.message);
    }

    return {
      ...data,
      status: data.status as 'active' | 'paused' | 'cancelled',
    };
  },

  /**
   * Delete an account
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting account:', error);
      throw new Error(error.message);
    }
  },

  /**
   * Get account users
   */
  async getUsers(accountId: string) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching account users:', error);
      throw new Error(error.message);
    }

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.user_id)
          .maybeSingle();

        return {
          ...profile,
          role: (roleData?.role as 'super_admin' | 'admin' | 'agent') || 'agent',
        };
      })
    );

    return usersWithRoles;
  },

  /**
   * Test Chatwoot connection
   */
  async testChatwootConnection(baseUrl: string, accountId: string, apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/agents`;
      
      const response = await fetch(url, {
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { success: true, message: 'Conexão estabelecida com sucesso!' };
      } else if (response.status === 401) {
        return { success: false, message: 'API Key inválida ou sem permissões' };
      } else {
        return { success: false, message: `Erro: ${response.status}` };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Erro de conexão' };
    }
  },
};
