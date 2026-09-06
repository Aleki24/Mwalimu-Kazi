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
      applications: {
        Row: {
          created_at: string
          id: string
          job_id: string
          match_score: number
          source: Database["public"]["Enums"]["application_source"]
          stage: Database["public"]["Enums"]["application_stage"]
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          match_score: number
          source?: Database["public"]["Enums"]["application_source"]
          stage?: Database["public"]["Enums"]["application_stage"]
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          match_score?: number
          source?: Database["public"]["Enums"]["application_source"]
          stage?: Database["public"]["Enums"]["application_stage"]
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_apply_events: {
        Row: {
          created_at: string
          id: string
          job_id: string
          match_score: number | null
          outcome: string
          reason: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          match_score?: number | null
          outcome: string
          reason?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          match_score?: number | null
          outcome?: string
          reason?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_apply_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_apply_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_apply_rules: {
        Row: {
          counties: string[]
          daily_limit: number
          enabled: boolean
          excluded_school_ids: string[]
          job_types: Database["public"]["Enums"]["job_type"][]
          min_match_score: number
          min_salary: number | null
          require_review_before_sending: boolean
          subjects: string[]
          teacher_id: string
          updated_at: string
          weekly_limit: number
        }
        Insert: {
          counties?: string[]
          daily_limit?: number
          enabled?: boolean
          excluded_school_ids?: string[]
          job_types?: Database["public"]["Enums"]["job_type"][]
          min_match_score?: number
          min_salary?: number | null
          require_review_before_sending?: boolean
          subjects?: string[]
          teacher_id: string
          updated_at?: string
          weekly_limit?: number
        }
        Update: {
          counties?: string[]
          daily_limit?: number
          enabled?: boolean
          excluded_school_ids?: string[]
          job_types?: Database["public"]["Enums"]["job_type"][]
          min_match_score?: number
          min_salary?: number | null
          require_review_before_sending?: boolean
          subjects?: string[]
          teacher_id?: string
          updated_at?: string
          weekly_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "auto_apply_rules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          closes_at: string | null
          county: string
          created_at: string
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          posted_at: string
          published: boolean
          requirements: Json
          salary_max: number | null
          salary_min: number | null
          school_id: string
          subjects: string[]
          title: string
        }
        Insert: {
          closes_at?: string | null
          county: string
          created_at?: string
          id?: string
          job_type: Database["public"]["Enums"]["job_type"]
          posted_at?: string
          published?: boolean
          requirements?: Json
          salary_max?: number | null
          salary_min?: number | null
          school_id: string
          subjects: string[]
          title: string
        }
        Update: {
          closes_at?: string | null
          county?: string
          created_at?: string
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          posted_at?: string
          published?: boolean
          requirements?: Json
          salary_max?: number | null
          salary_min?: number | null
          school_id?: string
          subjects?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          county: string
          created_at: string
          curricula: Database["public"]["Enums"]["curriculum"][]
          experience_years: number
          full_name: string
          has_degree: boolean
          headline: string | null
          id: string
          open_to_opportunities: boolean
          skills: string[]
          subjects: string[]
          tsc_number: string | null
          tsc_verified: boolean
          updated_at: string
        }
        Insert: {
          county: string
          created_at?: string
          curricula?: Database["public"]["Enums"]["curriculum"][]
          experience_years?: number
          full_name: string
          has_degree?: boolean
          headline?: string | null
          id: string
          open_to_opportunities?: boolean
          skills?: string[]
          subjects?: string[]
          tsc_number?: string | null
          tsc_verified?: boolean
          updated_at?: string
        }
        Update: {
          county?: string
          created_at?: string
          curricula?: Database["public"]["Enums"]["curriculum"][]
          experience_years?: number
          full_name?: string
          has_degree?: boolean
          headline?: string | null
          id?: string
          open_to_opportunities?: boolean
          skills?: string[]
          subjects?: string[]
          tsc_number?: string | null
          tsc_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      school_members: {
        Row: {
          role: Database["public"]["Enums"]["school_role"]
          school_id: string
          user_id: string
        }
        Insert: {
          role?: Database["public"]["Enums"]["school_role"]
          school_id: string
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["school_role"]
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          county: string
          created_at: string
          curricula: Database["public"]["Enums"]["curriculum"][]
          id: string
          name: string
          school_type: Database["public"]["Enums"]["school_type"]
          slug: string
          teacher_count: number | null
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          county: string
          created_at?: string
          curricula?: Database["public"]["Enums"]["curriculum"][]
          id?: string
          name: string
          school_type: Database["public"]["Enums"]["school_type"]
          slug: string
          teacher_count?: number | null
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          county?: string
          created_at?: string
          curricula?: Database["public"]["Enums"]["curriculum"][]
          id?: string
          name?: string
          school_type?: Database["public"]["Enums"]["school_type"]
          slug?: string
          teacher_count?: number | null
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_source: "manual" | "auto_apply"
      application_stage:
        | "saved"
        | "applied"
        | "viewed"
        | "shortlisted"
        | "interview"
        | "offered"
        | "rejected"
        | "withdrawn"
      curriculum: "cbc" | "8-4-4" | "igcse" | "ib" | "montessori"
      job_type: "full_time" | "part_time" | "contract" | "locum"
      school_role: "recruiter" | "admin"
      school_type: "private" | "international" | "public"
      verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "under_review"
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
    Enums: {
      application_source: ["manual", "auto_apply"],
      application_stage: [
        "saved",
        "applied",
        "viewed",
        "shortlisted",
        "interview",
        "offered",
        "rejected",
        "withdrawn",
      ],
      curriculum: ["cbc", "8-4-4", "igcse", "ib", "montessori"],
      job_type: ["full_time", "part_time", "contract", "locum"],
      school_role: ["recruiter", "admin"],
      school_type: ["private", "international", "public"],
      verification_status: [
        "unverified",
        "pending",
        "verified",
        "under_review",
      ],
    },
  },
} as const
