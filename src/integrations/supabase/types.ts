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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      evaluations: {
        Row: {
          agent_type: string
          completed_count: number
          created_at: string
          effectiveness_score: number | null
          error: string | null
          hallucination_risk: number | null
          id: string
          model: string
          prompt_id: string | null
          prompt_version_id: string | null
          prompt_snapshot: string
          scenario_count: number
          status: string
          summary: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_type: string
          completed_count?: number
          created_at?: string
          effectiveness_score?: number | null
          error?: string | null
          hallucination_risk?: number | null
          id?: string
          model: string
          prompt_id?: string | null
          prompt_version_id?: string | null
          prompt_snapshot: string
          scenario_count?: number
          status?: string
          summary?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          completed_count?: number
          created_at?: string
          effectiveness_score?: number | null
          error?: string | null
          hallucination_risk?: number | null
          id?: string
          model?: string
          prompt_id?: string | null
          prompt_snapshot?: string
          scenario_count?: number
          status?: string
          summary?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_comparisons: {
        Row: {
          agent_type: string
          completed_count: number
          created_at: string
          error: string | null
          id: string
          name: string
          results: Json
          scenario_count: number
          scenarios: Json
          status: string
          suite: string
          updated_at: string
          user_id: string
          variant_a: Json
          variant_b: Json
        }
        Insert: {
          agent_type: string
          completed_count?: number
          created_at?: string
          error?: string | null
          id?: string
          name?: string
          results?: Json
          scenario_count: number
          scenarios: Json
          status?: string
          suite: string
          updated_at?: string
          user_id?: string
          variant_a: Json
          variant_b: Json
        }
        Update: {
          agent_type?: string
          completed_count?: number
          created_at?: string
          error?: string | null
          id?: string
          name?: string
          results?: Json
          scenario_count?: number
          scenarios?: Json
          status?: string
          suite?: string
          updated_at?: string
          user_id?: string
          variant_a?: Json
          variant_b?: Json
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          change_note: string | null
          created_at: string
          id: string
          prompt_id: string
          snapshot: Json
          user_id: string
          version_number: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          id?: string
          prompt_id: string
          snapshot: Json
          user_id: string
          version_number: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          id?: string
          prompt_id?: string
          snapshot?: Json
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          agent_type: string
          begin_message: string
          created_at: string
          id: string
          model: string
          name: string
          stages: Json
          system_prompt: string
          updated_at: string
          user_id: string | null
          variables: Json
        }
        Insert: {
          agent_type?: string
          begin_message?: string
          created_at?: string
          id?: string
          model?: string
          name?: string
          stages?: Json
          system_prompt?: string
          updated_at?: string
          user_id?: string | null
          variables?: Json
        }
        Update: {
          agent_type?: string
          begin_message?: string
          created_at?: string
          id?: string
          model?: string
          name?: string
          stages?: Json
          system_prompt?: string
          updated_at?: string
          user_id?: string | null
          variables?: Json
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          category: string | null
          conversation: Json | null
          created_at: string
          effectiveness: number | null
          evaluation_id: string
          expected_behavior: string | null
          hallucination: number | null
          id: string
          idx: number
          notes: string | null
          passed: boolean | null
          status: string
          user_goal: string
        }
        Insert: {
          category?: string | null
          conversation?: Json | null
          created_at?: string
          effectiveness?: number | null
          evaluation_id: string
          expected_behavior?: string | null
          hallucination?: number | null
          id?: string
          idx: number
          notes?: string | null
          passed?: boolean | null
          status?: string
          user_goal: string
        }
        Update: {
          category?: string | null
          conversation?: Json | null
          created_at?: string
          effectiveness?: number | null
          evaluation_id?: string
          expected_behavior?: string | null
          hallucination?: number | null
          id?: string
          idx?: number
          notes?: string | null
          passed?: boolean | null
          status?: string
          user_goal?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_credit_accounts: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      voice_usage_ledger: {
        Row: {
          id: string
          user_id: string
          entry_type: string
          amount_seconds: number
          session_id: string | null
          idempotency_key: string
          actor_user_id: string | null
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entry_type: string
          amount_seconds: number
          session_id?: string | null
          idempotency_key: string
          actor_user_id?: string | null
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entry_type?: string
          amount_seconds?: number
          session_id?: string | null
          idempotency_key?: string
          actor_user_id?: string | null
          reason?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_usage_ledger_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_usage_reservations: {
        Row: {
          id: string
          user_id: string
          session_id: string
          reserved_seconds: number
          consumed_seconds: number | null
          status: string
          idempotency_key: string
          created_at: string
          finalized_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          reserved_seconds: number
          consumed_seconds?: number | null
          status?: string
          idempotency_key: string
          created_at?: string
          finalized_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          reserved_seconds?: number
          consumed_seconds?: number | null
          status?: string
          idempotency_key?: string
          created_at?: string
          finalized_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_usage_reservations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_session_events: {
        Row: {
          id: string
          session_id: string
          user_id: string
          event_key: string
          event_type: string
          source: string
          client_elapsed_ms: number | null
          measurement_status: string
          received_at: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          event_key: string
          event_type: string
          source: string
          client_elapsed_ms?: number | null
          measurement_status?: string
          received_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          event_key?: string
          event_type?: string
          source?: string
          client_elapsed_ms?: number | null
          measurement_status?: string
          received_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          id: string
          user_id: string
          provider: string
          provider_call_id: string | null
          status: string
          model: string
          voice: string
          prompt_fingerprint: string
          started_at: string
          connected_at: string | null
          ended_at: string | null
          duration_seconds: number | null
          end_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: string
          provider_call_id?: string | null
          status?: string
          model: string
          voice: string
          prompt_fingerprint: string
          started_at?: string
          connected_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          end_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          provider_call_id?: string | null
          status?: string
          model?: string
          voice?: string
          prompt_fingerprint?: string
          started_at?: string
          connected_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          end_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_voice_usage_summary: {
        Args: { p_user_id: string }
        Returns: {
          balance_seconds: number
          reserved_seconds: number
          granted_seconds: number
          used_seconds: number
        }[]
      }
      grant_voice_test_seconds: {
        Args: {
          p_user_id: string
          p_actor_user_id: string
          p_amount_seconds: number
          p_reason: string
          p_idempotency_key: string
        }
        Returns: { ledger_id: string; available_seconds: number }[]
      }
      reconcile_voice_test_seconds: {
        Args: {
          p_user_id: string
          p_session_id: string
          p_consumed_seconds: number
          p_idempotency_key: string
        }
        Returns: { reservation_id: string; consumed_seconds: number; available_seconds: number }[]
      }
      reserve_voice_test_seconds: {
        Args: {
          p_user_id: string
          p_session_id: string
          p_reserved_seconds: number
          p_idempotency_key: string
        }
        Returns: { reservation_id: string; available_seconds: number }[]
      }
      save_prompt_version: {
        Args: {
          p_change_note?: string | null
          p_payload: Json
          p_prompt_id: string | null
          p_user_id: string
        }
        Returns: {
          prompt_id: string
          version_id: string
          version_number: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
