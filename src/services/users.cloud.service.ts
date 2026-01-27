import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  user_id: string;
  account_id: string | null;
  nome: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  permissions: string[];
  chatwoot_agent_id: number | null;
  created_at: string;
  updated_at: string;
  role?: 'super_admin' | 'admin' | 'agent';
}

export interface CreateUserInput {
  email: string;
  password: string;
  nome: string;
  role: 'admin' | 'agent';
  account_id?: string;
  permissions?: string[];
  chatwoot_agent_id?: number;
}

export const usersCloudService = {
  /**
   * List all users (Super Admin) or account users (Admin)
   */
  async list(accountId?: string): Promise<Profile[]> {
    let query = supabase.from('profiles').select('*');

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: profiles, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
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
          status: profile.status as 'active' | 'inactive' | 'suspended',
          role: (roleData?.role as 'super_admin' | 'admin' | 'agent') || 'agent',
        };
      })
    );

    return usersWithRoles;
  },

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<Profile | null> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user:', error);
      throw new Error(error.message);
    }

    if (!profile) return null;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      ...profile,
      status: profile.status as 'active' | 'inactive' | 'suspended',
      role: (roleData?.role as 'super_admin' | 'admin' | 'agent') || 'agent',
    };
  },

  /**
   * Create a new user with role
   */
  async create(input: CreateUserInput): Promise<Profile> {
    // Create auth user via edge function would be needed for production
    // For now, we'll use the admin API workaround
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { nome: input.nome },
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError);
      throw new Error(authError?.message || 'Erro ao criar usuário');
    }

    const userId = authData.user.id;

    // Update profile with account_id and permissions
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        account_id: input.account_id,
        permissions: input.permissions || ['dashboard'],
        chatwoot_agent_id: input.chatwoot_agent_id,
      })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    // Assign role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: input.role,
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
    }

    const profile = await this.getById(userId);
    if (!profile) {
      throw new Error('Erro ao obter perfil do usuário');
    }

    return profile;
  },

  /**
   * Update user profile and role
   */
  async update(userId: string, input: Partial<Profile> & { role?: 'admin' | 'agent' }): Promise<Profile> {
    const updateData: Record<string, any> = {};
    
    if (input.nome) updateData.nome = input.nome;
    if (input.status) updateData.status = input.status;
    if (input.permissions) updateData.permissions = input.permissions;
    if (input.chatwoot_agent_id !== undefined) updateData.chatwoot_agent_id = input.chatwoot_agent_id;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating profile:', error);
        throw new Error(error.message);
      }
    }

    // Update role if provided
    if (input.role) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: input.role,
        }, {
          onConflict: 'user_id,role',
        });

      if (roleError) {
        console.error('Error updating role:', roleError);
      }
    }

    const profile = await this.getById(userId);
    if (!profile) {
      throw new Error('Usuário não encontrado');
    }

    return profile;
  },

  /**
   * Delete user
   */
  async delete(userId: string): Promise<void> {
    // Note: This will cascade delete the profile due to the FK constraint
    // In production, you'd want to use an admin function to delete from auth.users
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting user:', error);
      throw new Error(error.message);
    }
  },
};
