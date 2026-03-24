export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          chatwoot_account_id: string | null
          chatwoot_api_key: string | null
          chatwoot_base_url: string | null
          created_at: string | null
          google_client_id: string | null
          google_client_secret: string | null
          google_redirect_uri: string | null
          id: string
          limite_usuarios: number | null
          nome: string
          plano: string | null
          status: Database["public"]["Enums"]["account_status"] | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          chatwoot_account_id?: string | null
          chatwoot_api_key?: string | null
          chatwoot_base_url?: string | null
          created_at?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_redirect_uri?: string | null
          id?: string
          limite_usuarios?: number | null
          nome: string
          plano?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          chatwoot_account_id?: string | null
          chatwoot_api_key?: string | null
          chatwoot_base_url?: string | null
          created_at?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          google_redirect_uri?: string | null
          id?: string
          limite_usuarios?: number | null
          nome?: string
          plano?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          account_id: string
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          end_time: string
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          location: string | null
          meeting_link: string | null
          notes: string | null
          source: string | null
          start_time: string
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time: string
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          source?: string | null
          start_time: string
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          source?: string | null
          start_time?: string
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string
          chatwoot_contact_id: number | null
          chatwoot_conversation_id: number | null
          created_at: string | null
          email: string | null
          first_resolved_at: string | null
          id: string
          nome: string | null
          origem: Database["public"]["Enums"]["contact_origin"] | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          chatwoot_contact_id?: number | null
          chatwoot_conversation_id?: number | null
          created_at?: string | null
          email?: string | null
          first_resolved_at?: string | null
          id?: string
          nome?: string | null
          origem?: Database["public"]["Enums"]["contact_origin"] | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          chatwoot_contact_id?: number | null
          chatwoot_conversation_id?: number | null
          created_at?: string | null
          email?: string | null
          first_resolved_at?: string | null
          id?: string
          nome?: string | null
          origem?: Database["public"]["Enums"]["contact_origin"] | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          account_id: string | null
          actor_id: string | null
          channel: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          account_id?: string | null
          actor_id?: string | null
          channel?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          account_id?: string | null
          actor_id?: string | null
          channel?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnels_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          account_id: string
          calendar_id: string | null
          connected_email: string | null
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          account_id: string
          calendar_id?: string | null
          connected_email?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          account_id?: string
          calendar_id?: string | null
          connected_email?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          author_id: string
          author_name: string
          contact_id: string
          content: string
          created_at: string | null
          id: string
        }
        Insert: {
          author_id: string
          author_name: string
          contact_id: string
          content: string
          created_at?: string | null
          id?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          contact_id?: string
          content?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          applied_by_id: string | null
          contact_id: string
          created_at: string | null
          id: string
          source: string | null
          tag_id: string
        }
        Insert: {
          applied_by_id?: string | null
          contact_id: string
          created_at?: string | null
          id?: string
          source?: string | null
          tag_id: string
        }
        Update: {
          applied_by_id?: string | null
          contact_id?: string
          created_at?: string | null
          id?: string
          source?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          account_id: string
          ativo: boolean | null
          convenios_aceitos: string[] | null
          created_at: string | null
          id: string
          metodos_pagamento: string[] | null
          nome: string
          updated_at: string | null
          valor_padrao: number
        }
        Insert: {
          account_id: string
          ativo?: boolean | null
          convenios_aceitos?: string[] | null
          created_at?: string | null
          id?: string
          metodos_pagamento?: string[] | null
          nome: string
          updated_at?: string | null
          valor_padrao: number
        }
        Update: {
          account_id?: string
          ativo?: boolean | null
          convenios_aceitos?: string[] | null
          created_at?: string | null
          id?: string
          metodos_pagamento?: string[] | null
          nome?: string
          updated_at?: string | null
          valor_padrao?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_id: string | null
          chatwoot_agent_id: number | null
          created_at: string | null
          email: string
          id: string
          last_login_at: string | null
          nome: string
          permissions: string[] | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          chatwoot_agent_id?: number | null
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          nome: string
          permissions?: string[] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          chatwoot_agent_id?: number | null
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          nome?: string
          permissions?: string[] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      resolution_logs: {
        Row: {
          account_id: string
          agent_id: number | null
          ai_participated: boolean | null
          conversation_id: number
          created_at: string
          id: string
          resolution_type: string
          resolved_at: string
          resolved_by: string
        }
        Insert: {
          account_id: string
          agent_id?: number | null
          ai_participated?: boolean | null
          conversation_id: number
          created_at?: string
          id?: string
          resolution_type?: string
          resolved_at?: string
          resolved_by: string
        }
        Update: {
          account_id?: string
          agent_id?: number | null
          ai_participated?: boolean | null
          conversation_id?: number
          created_at?: string
          id?: string
          resolution_type?: string
          resolved_at?: string
          resolved_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolution_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          product_id: string
          quantidade: number | null
          refund_reason: string | null
          refunded: boolean | null
          refunded_at: string | null
          sale_id: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          id?: string
          product_id: string
          quantidade?: number | null
          refund_reason?: string | null
          refunded?: boolean | null
          refunded_at?: string | null
          sale_id: string
          valor_total: number
          valor_unitario: number
        }
        Update: {
          id?: string
          product_id?: string
          quantidade?: number | null
          refund_reason?: string | null
          refunded?: boolean | null
          refunded_at?: string | null
          sale_id?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          account_id: string
          contact_id: string
          convenio_nome: string | null
          created_at: string | null
          id: string
          is_recurring: boolean | null
          metodo_pagamento: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          responsavel_id: string
          status: Database["public"]["Enums"]["sale_status"] | null
          valor: number
        }
        Insert: {
          account_id: string
          contact_id: string
          convenio_nome?: string | null
          created_at?: string | null
          id?: string
          is_recurring?: boolean | null
          metodo_pagamento: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          responsavel_id: string
          status?: Database["public"]["Enums"]["sale_status"] | null
          valor: number
        }
        Update: {
          account_id?: string
          contact_id?: string
          convenio_nome?: string | null
          created_at?: string | null
          id?: string
          is_recurring?: boolean | null
          metodo_pagamento?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          responsavel_id?: string
          status?: Database["public"]["Enums"]["sale_status"] | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_history: {
        Row: {
          action: string
          actor_id: string | null
          contact_id: string | null
          contact_nome: string | null
          created_at: string | null
          id: string
          source: string | null
          tag_id: string | null
          tag_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          contact_id?: string | null
          contact_nome?: string | null
          created_at?: string | null
          id?: string
          source?: string | null
          tag_id?: string | null
          tag_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          contact_id?: string | null
          contact_nome?: string | null
          created_at?: string | null
          id?: string
          source?: string | null
          tag_id?: string | null
          tag_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_history_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          account_id: string
          ativo: boolean | null
          chatwoot_label_id: number | null
          color: string | null
          created_at: string | null
          funnel_id: string
          id: string
          name: string
          ordem: number | null
          slug: string
          type: Database["public"]["Enums"]["tag_type"]
        }
        Insert: {
          account_id: string
          ativo?: boolean | null
          chatwoot_label_id?: number | null
          color?: string | null
          created_at?: string | null
          funnel_id: string
          id?: string
          name: string
          ordem?: number | null
          slug: string
          type: Database["public"]["Enums"]["tag_type"]
        }
        Update: {
          account_id?: string
          ativo?: boolean | null
          chatwoot_label_id?: number | null
          color?: string | null
          created_at?: string | null
          funnel_id?: string
          id?: string
          name?: string
          ordem?: number | null
          slug?: string
          type?: Database["public"]["Enums"]["tag_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tags_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_account_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_admin: { Args: { _account_id: string }; Returns: boolean }
      is_account_member: { Args: { _account_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      account_status: "active" | "paused" | "cancelled"
      app_role: "super_admin" | "admin" | "agent"
      contact_origin: "whatsapp" | "instagram" | "site" | "indicacao" | "outro"
      payment_method:
        | "pix"
        | "boleto"
        | "debito"
        | "credito"
        | "dinheiro"
        | "convenio"
      sale_status: "pending" | "paid" | "refunded" | "partial_refund"
      tag_type: "stage" | "operational"
      user_status: "active" | "inactive" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "paused", "cancelled"],
      app_role: ["super_admin", "admin", "agent"],
      contact_origin: ["whatsapp", "instagram", "site", "indicacao", "outro"],
      payment_method: [
        "pix",
        "boleto",
        "debito",
        "credito",
        "dinheiro",
        "convenio",
      ],
      sale_status: ["pending", "paid", "refunded", "partial_refund"],
      tag_type: ["stage", "operational"],
      user_status: ["active", "inactive", "suspended"],
    },
  },
} as const
