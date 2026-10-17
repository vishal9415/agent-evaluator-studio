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
          prompt_snapshot: string
          scenario_count: number
          status: string
          summary: Json | null
          updated_at: string
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
          scenario_count?: number
          status?: string
          summary?: Json | null
          updated_at?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
