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
    PostgrestVersion: "14.18"
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
          prompt_snapshot: string
          prompt_version_id: string | null
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
          prompt_snapshot: string
          prompt_version_id?: string | null
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
          prompt_version_id?: string | null
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
          user_id: string
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
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_session_events: {
        Row: {
          client_elapsed_ms: number | null
          created_at: string
          event_key: string
          event_type: string
          id: string
          measurement_status: string
          received_at: string
          session_id: string
          source: string
          user_id: string
        }
        Insert: {
          client_elapsed_ms?: number | null
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          measurement_status?: string
          received_at?: string
          session_id: string
          source: string
          user_id: string
        }
        Update: {
          client_elapsed_ms?: number | null
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          measurement_status?: string
          received_at?: string
          session_id?: string
          source?: string
          user_id?: string
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
          connected_at: string | null
          created_at: string
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          id: string
          model: string
          prompt_fingerprint: string
          provider: string
          provider_call_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
          voice: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          model: string
          prompt_fingerprint: string
          provider?: string
          provider_call_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
          voice: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          model?: string
          prompt_fingerprint?: string
          provider?: string
          provider_call_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          voice?: string
        }
        Relationships: []
      }
      voice_usage_ledger: {
        Row: {
          actor_user_id: string | null
          amount_seconds: number
          created_at: string
          entry_type: string
          id: string
          idempotency_key: string
          reason: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          amount_seconds: number
          created_at?: string
          entry_type: string
          id?: string
          idempotency_key: string
          reason: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          amount_seconds?: number
          created_at?: string
          entry_type?: string
          id?: string
          idempotency_key?: string
          reason?: string
          session_id?: string | null
          user_id?: string
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
          consumed_seconds: number | null
          created_at: string
          finalized_at: string | null
          id: string
          idempotency_key: string
          reserved_seconds: number
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          consumed_seconds?: number | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          idempotency_key: string
          reserved_seconds: number
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          consumed_seconds?: number | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          idempotency_key?: string
          reserved_seconds?: number
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_usage_reservations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
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
          granted_seconds: number
          reserved_seconds: number
          used_seconds: number
        }[]
      }
      grant_voice_test_seconds: {
        Args: {
          p_actor_user_id: string
          p_amount_seconds: number
          p_idempotency_key: string
          p_reason: string
          p_user_id: string
        }
        Returns: {
          available_seconds: number
          ledger_id: string
        }[]
      }
      reconcile_voice_test_seconds: {
        Args: {
          p_consumed_seconds: number
          p_idempotency_key: string
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          available_seconds: number
          consumed_seconds: number
          reservation_id: string
        }[]
      }
      reserve_voice_test_seconds: {
        Args: {
          p_idempotency_key: string
          p_reserved_seconds: number
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          available_seconds: number
          reservation_id: string
        }[]
      }
      save_prompt_version: {
        Args: {
          p_change_note?: string
          p_payload: Json
          p_prompt_id: string
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
