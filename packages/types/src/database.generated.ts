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
          area: string | null
          level: Database["public"]["Enums"]["teaching_level"] | null
          meets_at_student: boolean
          meets_at_teacher: boolean
          meets_online: boolean
          posted_by_name: string | null
          poster_role: Database["public"]["Enums"]["poster_role"] | null
          preferred_gender: Database["public"]["Enums"]["gender_preference"] | null
          prefers_locality: string | null
          engagement: Database["public"]["Enums"]["engagement_kind"]
          learner_level: string | null
          rate_period: Database["public"]["Enums"]["rate_period"]
          sessions_per_week: number | null
          closes_at: string | null
          county: string
          created_at: string
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          posted_at: string
          published: boolean
          requirements: Json
          salary_max: number | null
          posted_by: string | null
          poster_kind: Database["public"]["Enums"]["job_poster_kind"]
          salary_min: number | null
          school_id: string | null
          subjects: string[]
          title: string
        }
        Insert: {
          area?: string | null
          level?: Database["public"]["Enums"]["teaching_level"] | null
          meets_at_student?: boolean
          meets_at_teacher?: boolean
          meets_online?: boolean
          posted_by_name?: string | null
          poster_role?: Database["public"]["Enums"]["poster_role"] | null
          preferred_gender?: Database["public"]["Enums"]["gender_preference"] | null
          prefers_locality?: string | null
          engagement?: Database["public"]["Enums"]["engagement_kind"]
          learner_level?: string | null
          rate_period?: Database["public"]["Enums"]["rate_period"]
          sessions_per_week?: number | null
          closes_at?: string | null
          county: string
          created_at?: string
          id?: string
          job_type: Database["public"]["Enums"]["job_type"]
          posted_at?: string
          published?: boolean
          requirements?: Json
          salary_max?: number | null
          posted_by?: string | null
          poster_kind?: Database["public"]["Enums"]["job_poster_kind"]
          salary_min?: number | null
          school_id?: string | null
          subjects: string[]
          title: string
        }
        Update: {
          area?: string | null
          level?: Database["public"]["Enums"]["teaching_level"] | null
          meets_at_student?: boolean
          meets_at_teacher?: boolean
          meets_online?: boolean
          posted_by_name?: string | null
          poster_role?: Database["public"]["Enums"]["poster_role"] | null
          preferred_gender?: Database["public"]["Enums"]["gender_preference"] | null
          prefers_locality?: string | null
          engagement?: Database["public"]["Enums"]["engagement_kind"]
          learner_level?: string | null
          rate_period?: Database["public"]["Enums"]["rate_period"]
          sessions_per_week?: number | null
          closes_at?: string | null
          county?: string
          created_at?: string
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          posted_at?: string
          published?: boolean
          requirements?: Json
          salary_max?: number | null
          posted_by?: string | null
          poster_kind?: Database["public"]["Enums"]["job_poster_kind"]
          salary_min?: number | null
          school_id?: string | null
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
      message_threads: {
        Row: {
          application_id: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          body: string | null
          id: string
          image_url: string | null
          published_at: string
          source: string
          summary: string | null
          title: string
          topic: Database["public"]["Enums"]["news_topic"]
          url: string | null
        }
        Insert: {
          body?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          source: string
          summary?: string | null
          title: string
          topic: Database["public"]["Enums"]["news_topic"]
          url?: string | null
        }
        Update: {
          body?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string
          summary?: string | null
          title?: string
          topic?: Database["public"]["Enums"]["news_topic"]
          url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          notification_sound: boolean
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
          notification_sound?: boolean
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
          notification_sound?: boolean
          open_to_opportunities?: boolean
          skills?: string[]
          subjects?: string[]
          tsc_number?: string | null
          tsc_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          created_at: string
          download_count: number
          file_extension: string
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          size_bytes: number
          storage_path: string
          subject: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          download_count?: number
          file_extension: string
          id?: string
          kind: Database["public"]["Enums"]["resource_kind"]
          size_bytes: number
          storage_path: string
          subject?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          download_count?: number
          file_extension?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          size_bytes?: number
          storage_path?: string
          subject?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_ratings: {
        Row: {
          category: Database["public"]["Enums"]["review_category"]
          review_id: string
          score: number
        }
        Insert: {
          category: Database["public"]["Enums"]["review_category"]
          review_id: string
          score: number
        }
        Update: {
          category?: Database["public"]["Enums"]["review_category"]
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_ratings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "school_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_red_flags: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["red_flag_kind"]
          occurred_on: string | null
          reason: string
          review_id: string
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["red_flag_kind"]
          occurred_on?: string | null
          reason: string
          review_id: string
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["red_flag_kind"]
          occurred_on?: string | null
          reason?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_red_flags_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "school_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          created_at: string
          job_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      school_reviews: {
        Row: {
          author_id: string
          body: string
          created_at: string
          employment_verified: boolean
          id: string
          moderation: Database["public"]["Enums"]["moderation_status"]
          role_title: string | null
          school_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          employment_verified?: boolean
          id?: string
          moderation?: Database["public"]["Enums"]["moderation_status"]
          role_title?: string | null
          school_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          employment_verified?: boolean
          id?: string
          moderation?: Database["public"]["Enums"]["moderation_status"]
          role_title?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          about: string | null
          county: string
          cover_url: string | null
          created_at: string
          curricula: Database["public"]["Enums"]["curriculum"][]
          facilities: string[]
          id: string
          name: string
          school_type: Database["public"]["Enums"]["school_type"]
          slug: string
          student_count: number | null
          teacher_count: number | null
          verification: Database["public"]["Enums"]["verification_status"]
          website: string | null
        }
        Insert: {
          about?: string | null
          county: string
          cover_url?: string | null
          created_at?: string
          curricula?: Database["public"]["Enums"]["curriculum"][]
          facilities?: string[]
          id?: string
          name: string
          school_type: Database["public"]["Enums"]["school_type"]
          slug: string
          student_count?: number | null
          teacher_count?: number | null
          verification?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Update: {
          about?: string | null
          county?: string
          cover_url?: string | null
          created_at?: string
          curricula?: Database["public"]["Enums"]["curriculum"][]
          facilities?: string[]
          id?: string
          name?: string
          school_type?: Database["public"]["Enums"]["school_type"]
          slug?: string
          student_count?: number | null
          teacher_count?: number | null
          verification?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Relationships: []
      }
      cv_details: {
        Row: {
          address: string | null
          date_of_birth: string | null
          email: string | null
          gender: string | null
          hobbies: string[]
          languages: string[]
          location: string | null
          nationality: string | null
          phone: string | null
          photo_path: string | null
          post_code: string | null
          responsibilities: string[]
          summary: string | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["cv_visibility"]
        }
        Insert: {
          address?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          hobbies?: string[]
          languages?: string[]
          location?: string | null
          nationality?: string | null
          phone?: string | null
          photo_path?: string | null
          post_code?: string | null
          responsibilities?: string[]
          summary?: string | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["cv_visibility"]
        }
        Update: {
          address?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          hobbies?: string[]
          languages?: string[]
          location?: string | null
          nationality?: string | null
          phone?: string | null
          photo_path?: string | null
          post_code?: string | null
          responsibilities?: string[]
          summary?: string | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["cv_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "cv_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_certificates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_ongoing: boolean
          title: string
          user_id: string
          year: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_ongoing?: boolean
          title: string
          user_id: string
          year?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_ongoing?: boolean
          title?: string
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cv_certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_education: {
        Row: {
          created_at: string
          end_year: number | null
          grade: string | null
          id: string
          institution: string
          qualification: string
          start_year: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          end_year?: number | null
          grade?: string | null
          id?: string
          institution: string
          qualification: string
          start_year?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          end_year?: number | null
          grade?: string | null
          id?: string
          institution?: string
          qualification?: string
          start_year?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_education_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_experience: {
        Row: {
          created_at: string
          description: string | null
          end_year: number | null
          id: string
          is_current: boolean
          is_volunteer: boolean
          organisation: string
          role: string
          start_year: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          is_volunteer?: boolean
          organisation: string
          role: string
          start_year?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          is_volunteer?: boolean
          organisation?: string
          role?: string
          start_year?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_experience_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_referees: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          organisation: string | null
          phone: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organisation?: string | null
          phone?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organisation?: string | null
          phone?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_referees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          granted_at: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      am_i_platform_admin: { Args: never; Returns: boolean }
      record_resource_download: {
        Args: { target_resource: string }
        Returns: undefined
      }
      create_school: {
        Args: {
          p_county: string
          p_curricula?: Database["public"]["Enums"]["curriculum"][]
          p_name: string
          p_school_type: Database["public"]["Enums"]["school_type"]
        }
        Returns: string
      }
      submit_school_review: {
        Args: {
          p_body: string
          p_ratings: Json
          p_red_flags?: Json
          p_role_title: string
          p_school_id: string
        }
        Returns: string
      }
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
      cv_visibility: "private" | "applied" | "open"
      engagement_kind: "employment" | "tuition" | "homeschool" | "assignment"
      gender_preference: "any" | "female" | "male"
      poster_role: "parent" | "student" | "professional" | "school"
      teaching_level: "beginner" | "intermediate" | "expert"
      rate_period: "month" | "hour" | "session"
      job_poster_kind: "school" | "individual" | "platform"
      job_type: "full_time" | "part_time" | "contract" | "locum"
      moderation_status: "pending" | "approved" | "rejected"
      news_topic:
        | "tsc"
        | "knec"
        | "kicd"
        | "cbc"
        | "policy"
        | "recruitment"
        | "scholarships"
        | "professional_development"
      notification_kind:
        | "job_match"
        | "auto_apply_sent"
        | "auto_apply_failed"
        | "application_viewed"
        | "shortlisted"
        | "rejected"
        | "interview_invite"
        | "profile_viewed"
        | "school_review"
        | "followed_school_job"
        | "news"
        | "resource"
        | "message"
      red_flag_kind:
        | "salary_delays"
        | "excessive_workload"
        | "poor_management"
        | "contract_issues"
        | "harassment"
        | "unclear_hours"
        | "poor_communication"
        | "unsafe_conditions"
      resource_kind:
        | "notes"
        | "scheme_of_work"
        | "lesson_plan"
        | "past_paper"
        | "marking_scheme"
        | "worksheet"
        | "slides"
        | "assessment"
      review_category:
        | "management"
        | "pay_reliability"
        | "workload"
        | "working_hours"
        | "teacher_treatment"
        | "professional_growth"
        | "housing"
        | "student_behaviour"
        | "resources"
        | "communication"
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
      cv_visibility: ["private", "applied", "open"],
      engagement_kind: ["employment", "tuition", "homeschool", "assignment"],
      gender_preference: ["any", "female", "male"],
      poster_role: ["parent", "student", "professional", "school"],
      teaching_level: ["beginner", "intermediate", "expert"],
      rate_period: ["month", "hour", "session"],
      job_poster_kind: ["school", "individual", "platform"],
      job_type: ["full_time", "part_time", "contract", "locum"],
      moderation_status: ["pending", "approved", "rejected"],
      news_topic: [
        "tsc",
        "knec",
        "kicd",
        "cbc",
        "policy",
        "recruitment",
        "scholarships",
        "professional_development",
      ],
      notification_kind: [
        "job_match",
        "auto_apply_sent",
        "auto_apply_failed",
        "application_viewed",
        "shortlisted",
        "rejected",
        "interview_invite",
        "profile_viewed",
        "school_review",
        "followed_school_job",
        "news",
        "resource",
        "message",
      ],
      red_flag_kind: [
        "salary_delays",
        "excessive_workload",
        "poor_management",
        "contract_issues",
        "harassment",
        "unclear_hours",
        "poor_communication",
        "unsafe_conditions",
      ],
      resource_kind: [
        "notes",
        "scheme_of_work",
        "lesson_plan",
        "past_paper",
        "marking_scheme",
        "worksheet",
        "slides",
        "assessment",
      ],
      review_category: [
        "management",
        "pay_reliability",
        "workload",
        "working_hours",
        "teacher_treatment",
        "professional_growth",
        "housing",
        "student_behaviour",
        "resources",
        "communication",
      ],
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
