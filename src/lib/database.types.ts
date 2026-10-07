export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      application_answers: {
        Row: {
          answer: string
          application_id: string
          question_id: string
        }
        Insert: {
          answer: string
          application_id: string
          question_id: string
        }
        Update: {
          answer?: string
          application_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "job_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          from_stage: string | null
          id: string
          note: string
          to_stage: string | null
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string
          to_stage?: string | null
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string
          to_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_from_stage_fkey"
            columns: ["from_stage"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_to_stage_fkey"
            columns: ["to_stage"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          job_id: string
          resume_id: string | null
          stage_id: string
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          job_id: string
          resume_id?: string | null
          stage_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          job_id?: string
          resume_id?: string | null
          stage_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_stage_id_fkey"
            columns: ["job_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["job_id", "id"]
          },
          {
            foreignKeyName: "applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          resource: string
          resource_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          resource: string
          resource_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          resource?: string
          resource_id?: string | null
        }
        Relationships: []
      }
      candidate_interests: {
        Row: {
          area_id: string
          candidate_id: string
        }
        Insert: {
          area_id: string
          candidate_id: string
        }
        Update: {
          area_id?: string
          candidate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_interests_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "interest_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_interests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tags: {
        Row: {
          candidate_id: string
          tag_id: string
        }
        Insert: {
          candidate_id: string
          tag_id: string
        }
        Update: {
          candidate_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tags_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          additional_info: Json
          archived_at: string | null
          availability: string
          city: string
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          headline: string
          id: string
          legal_basis: string | null
          phone: string
          processing_purpose: string
          professional_url: string
          search_document: unknown
          skills: string[]
          source: string
          state: string
          summary: string
          talent_pool: boolean
          updated_at: string
          user_id: string | null
          work_model: string
        }
        Insert: {
          additional_info?: Json
          archived_at?: string | null
          availability?: string
          city?: string
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          headline?: string
          id?: string
          legal_basis?: string | null
          phone?: string
          processing_purpose?: string
          professional_url?: string
          search_document?: unknown
          skills?: string[]
          source?: string
          state?: string
          summary?: string
          talent_pool?: boolean
          updated_at?: string
          user_id?: string | null
          work_model?: string
        }
        Update: {
          additional_info?: Json
          archived_at?: string | null
          availability?: string
          city?: string
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          headline?: string
          id?: string
          legal_basis?: string | null
          phone?: string
          processing_purpose?: string
          professional_url?: string
          search_document?: unknown
          skills?: string[]
          source?: string
          state?: string
          summary?: string
          talent_pool?: boolean
          updated_at?: string
          user_id?: string | null
          work_model?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          kind: string
          mime: string
          object_path: string
          original_name: string
          scan_message: string | null
          scanned_at: string | null
          sha256: string | null
          size_bytes: number
          status: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          kind: string
          mime: string
          object_path: string
          original_name: string
          scan_message?: string | null
          scanned_at?: string | null
          sha256?: string | null
          size_bytes: number
          status?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          kind?: string
          mime?: string
          object_path?: string
          original_name?: string
          scan_message?: string | null
          scanned_at?: string | null
          sha256?: string | null
          size_bytes?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_types: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          application_id: string
          author_id: string
          body: string
          created_at: string
          criteria: string
          id: string
          kind: string
          recommendation: string
        }
        Insert: {
          application_id: string
          author_id: string
          body: string
          created_at?: string
          criteria?: string
          id?: string
          kind: string
          recommendation?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          body?: string
          created_at?: string
          criteria?: string
          id?: string
          kind?: string
          recommendation?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      experience_levels: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      interest_areas: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          application_id: string
          created_at: string
          duration_minutes: number
          id: string
          interviewer_id: string
          location: string
          mode: string
          notes: string
          starts_at: string
          status: string
        }
        Insert: {
          application_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id: string
          location: string
          mode?: string
          notes?: string
          starts_at: string
          status?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id?: string
          location?: string
          mode?: string
          notes?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          job_id: string
          user_id: string
        }
        Insert: {
          job_id: string
          user_id: string
        }
        Update: {
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_questions: {
        Row: {
          id: string
          job_id: string
          kind: string
          label: string
          options: string[]
          position: number
          required: boolean
        }
        Insert: {
          id?: string
          job_id: string
          kind?: string
          label: string
          options?: string[]
          position?: number
          required?: boolean
        }
        Update: {
          id?: string
          job_id?: string
          kind?: string
          label?: string
          options?: string[]
          position?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "job_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stages: {
        Row: {
          id: string
          job_id: string
          name: string
          position: number
          terminal: boolean
        }
        Insert: {
          id?: string
          job_id: string
          name: string
          position: number
          terminal?: boolean
        }
        Update: {
          id?: string
          job_id?: string
          name?: string
          position?: number
          terminal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "job_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          benefits: string
          city: string
          code: number
          contract_type: string
          created_at: string
          created_by: string | null
          deadline: string | null
          department_id: string | null
          description: string
          employment_type_id: string | null
          experience_level_id: string | null
          id: string
          openings: number
          published_at: string | null
          requirements: string
          responsibilities: string
          slug: string
          state: string
          status: string
          title: string
          updated_at: string
          visibility: string
          work_model: string
        }
        Insert: {
          benefits?: string
          city: string
          code?: never
          contract_type?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description: string
          employment_type_id?: string | null
          experience_level_id?: string | null
          id?: string
          openings?: number
          published_at?: string | null
          requirements?: string
          responsibilities?: string
          slug: string
          state?: string
          status?: string
          title: string
          updated_at?: string
          visibility?: string
          work_model: string
        }
        Update: {
          benefits?: string
          city?: string
          code?: never
          contract_type?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department_id?: string | null
          description?: string
          employment_type_id?: string | null
          experience_level_id?: string | null
          id?: string
          openings?: number
          published_at?: string | null
          requirements?: string
          responsibilities?: string
          slug?: string
          state?: string
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
          work_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_employment_type_id_fkey"
            columns: ["employment_type_id"]
            isOneToOne: false
            referencedRelation: "employment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_experience_level_id_fkey"
            columns: ["experience_level_id"]
            isOneToOne: false
            referencedRelation: "experience_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          id: string
          name: string
          subject: string
        }
        Insert: {
          active?: boolean
          body: string
          id?: string
          name: string
          subject: string
        }
        Update: {
          active?: boolean
          body?: string
          id?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          candidate_id: string
          created_at: string
          id: string
          sender_id: string
          subject: string
        }
        Insert: {
          body: string
          candidate_id: string
          created_at?: string
          id?: string
          sender_id: string
          subject: string
        }
        Update: {
          body?: string
          candidate_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      policy_acknowledgements: {
        Row: {
          candidate_id: string
          created_at: string
          granted: boolean
          id: string
          policy_id: string
          purpose: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          granted: boolean
          id?: string
          policy_id: string
          purpose: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          granted?: boolean
          id?: string
          policy_id?: string
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgements_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "privacy_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_members: {
        Row: {
          candidate_id: string
          pool_id: string
        }
        Insert: {
          candidate_id: string
          pool_id: string
        }
        Update: {
          candidate_id?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "talent_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_policies: {
        Row: {
          active: boolean
          body: string
          id: string
          published_at: string | null
          title: string
          version: string
        }
        Insert: {
          active?: boolean
          body: string
          id?: string
          published_at?: string | null
          title: string
          version: string
        }
        Update: {
          active?: boolean
          body?: string
          id?: string
          published_at?: string | null
          title?: string
          version?: string
        }
        Relationships: []
      }
      privacy_requests: {
        Row: {
          assigned_to: string | null
          candidate_id: string
          created_at: string
          detail: string
          due_at: string | null
          id: string
          kind: string
          resolution: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          candidate_id: string
          created_at?: string
          detail?: string
          due_at?: string | null
          id?: string
          kind: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          candidate_id?: string
          created_at?: string
          detail?: string
          due_at?: string | null
          id?: string
          kind?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "privacy_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_entries: {
        Row: {
          candidate_id: string
          created_at: string
          description: string
          duration_hours: number | null
          end_date: string | null
          id: string
          kind: string
          level: string
          organization: string
          period_text: string
          start_date: string | null
          status: string
          title: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          description?: string
          duration_hours?: number | null
          end_date?: string | null
          id?: string
          kind: string
          level?: string
          organization?: string
          period_text?: string
          start_date?: string | null
          status?: string
          title: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          description?: string
          duration_hours?: number | null
          end_date?: string | null
          id?: string
          kind?: string
          level?: string
          organization?: string
          period_text?: string
          start_date?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_entries_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role_id: string
        }
        Insert: {
          permission: string
          role_id: string
        }
        Update: {
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          active: boolean
          id: string
          name: string
          require_mfa: boolean
          scope: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
          require_mfa?: boolean
          scope?: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          require_mfa?: boolean
          scope?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          mfa_enabled: boolean
          password_login_enabled: boolean
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          mfa_enabled?: boolean
          password_login_enabled?: boolean
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          mfa_enabled?: boolean
          password_login_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      staff_roles: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tags: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      talent_pools: {
        Row: {
          active: boolean
          description: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          description?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_evaluation: {
        Args: {
          p_application_id: string
          p_body: string
          p_criteria?: string
          p_kind: string
          p_recommendation?: string
        }
        Returns: undefined
      }
      add_job_item: {
        Args: {
          p_job_id: string
          p_kind: string
          p_label: string
          p_required?: boolean
        }
        Returns: undefined
      }
      authorize_curriculum_export: {
        Args: { p_candidate_id: string }
        Returns: undefined
      }
      authorize_download: { Args: { p_document_id: string }; Returns: string }
      authorize_staff_password_reset: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      bootstrap_password_staff: {
        Args: { p_display_name: string; p_user_id: string }
        Returns: string
      }
      can_application: {
        Args: { p_application_id: string; p_permission: string }
        Returns: boolean
      }
      can_candidate: {
        Args: { p_candidate_id: string; p_permission: string }
        Returns: boolean
      }
      claim_email_delivery: { Args: { p_key: string }; Returns: Json }
      consume_account_email_code: { Args: { p_code: string }; Returns: boolean }
      consume_signup_quota: { Args: { p_key: string }; Returns: boolean }
      create_manual_candidate: { Args: { p_data: Json }; Returns: string }
      curriculum_missing: {
        Args: { p_candidate_id: string }
        Returns: string[]
      }
      delete_catalog: {
        Args: { p_catalog: string; p_id: string }
        Returns: undefined
      }
      delete_job_question: {
        Args: { p_job_id: string; p_question_id: string }
        Returns: undefined
      }
      export_candidates: {
        Args: never
        Returns: {
          city: string
          created_at: string
          full_name: string
          headline: string
          id: string
        }[]
      }
      export_my_data: { Args: never; Returns: Json }
      finish_email_delivery: {
        Args: { p_key: string; p_lease: string; p_sent: boolean }
        Returns: boolean
      }
      finish_staff_password_reset: {
        Args: { p_actor_id: string; p_user_id: string }
        Returns: undefined
      }
      guard_candidate_signup: { Args: { event: Json }; Returns: Json }
      has_permission: {
        Args: { p_job_id?: string; p_permission: string }
        Returns: boolean
      }
      is_primary_administrator: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      issue_account_email_code: { Args: { p_user_id: string }; Returns: Json }
      link_candidate_to_job: {
        Args: { p_candidate_id: string; p_job_id: string; p_note: string }
        Returns: string
      }
      list_managed_staff: {
        Args: never
        Returns: {
          active: boolean
          display_name: string
          email: string
          is_primary: boolean
          mfa_enabled: boolean
          password_login_enabled: boolean
          role_id: string
          user_id: string
        }[]
      }
      manage_candidate_curriculum: {
        Args: { p_candidate_id: string; p_data: Json }
        Returns: undefined
      }
      manage_catalog: {
        Args: {
          p_active?: boolean
          p_catalog: string
          p_id?: string
          p_name: string
        }
        Returns: undefined
      }
      manage_role: {
        Args: {
          p_id?: string
          p_mfa: boolean
          p_name: string
          p_permissions: string[]
          p_scope: string
        }
        Returns: string
      }
      manage_staff: {
        Args: {
          p_active: boolean
          p_email: string
          p_name: string
          p_role_id: string
        }
        Returns: undefined
      }
      mark_notification: { Args: { p_id: string }; Returns: undefined }
      move_application: {
        Args: {
          p_application_id: string
          p_expected_stage: string
          p_note?: string
          p_stage_id: string
        }
        Returns: undefined
      }
      my_registration: { Args: never; Returns: Json }
      owns_application: { Args: { p_application_id: string }; Returns: boolean }
      owns_candidate: { Args: { p_candidate_id: string }; Returns: boolean }
      owns_job_application: { Args: { p_job_id: string }; Returns: boolean }
      prepare_candidate_signup: {
        Args: {
          p_birth_date: string
          p_cpf: string
          p_email: string
          p_email_key: string
          p_origin_key: string
          p_ticket_hash: string
        }
        Returns: boolean
      }
      provision_staff: {
        Args: {
          p_active: boolean
          p_actor_id: string
          p_mfa: boolean
          p_name: string
          p_role_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      publish_privacy_policy: {
        Args: { p_body: string; p_title: string; p_version: string }
        Returns: string
      }
      register_document: {
        Args: {
          p_candidate_id: string
          p_kind: string
          p_name: string
          p_size: number
        }
        Returns: {
          candidate_id: string
          created_at: string
          id: string
          kind: string
          mime: string
          object_path: string
          original_name: string
          scan_message: string | null
          scanned_at: string | null
          sha256: string | null
          size_bytes: number
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_privacy: {
        Args: { p_detail?: string; p_kind: string }
        Returns: string
      }
      resolve_privacy: {
        Args: { p_id: string; p_resolution: string; p_status: string }
        Returns: undefined
      }
      revoke_account_email_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: undefined
      }
      save_candidate: {
        Args: { p_candidate_id?: string; p_data: Json }
        Returns: string
      }
      save_job: { Args: { p_data: Json; p_job_id?: string }; Returns: string }
      save_job_question: {
        Args: { p_data: Json; p_job_id: string; p_question_id?: string }
        Returns: string
      }
      save_job_stages: {
        Args: { p_expected: Json; p_job_id: string; p_stages: Json }
        Returns: undefined
      }
      save_privacy: {
        Args: { p_policy_id: string; p_talent_pool: boolean }
        Returns: undefined
      }
      save_profile_entry: {
        Args: { p_candidate_id: string; p_data: Json; p_entry_id?: string }
        Returns: string
      }
      schedule_interview: {
        Args: {
          p_application_id: string
          p_duration?: number
          p_location: string
          p_starts_at: string
        }
        Returns: undefined
      }
      send_message: {
        Args: { p_body: string; p_candidate_id: string; p_subject: string }
        Returns: undefined
      }
      set_account_mfa: {
        Args: { p_email_code?: string; p_enabled: boolean }
        Returns: boolean
      }
      set_job_status: {
        Args: { p_job_id: string; p_status: string }
        Returns: undefined
      }
      staff_navigation_permissions: { Args: never; Returns: string[] }
      submit_application: {
        Args: { p_answers: Json; p_job_id: string; p_policy_id: string }
        Returns: string
      }
      update_account_name: { Args: { p_name: string }; Returns: undefined }
      update_managed_staff: {
        Args: {
          p_active: boolean
          p_mfa: boolean
          p_name: string
          p_role_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_profile_entry: {
        Args: { p_candidate_id: string; p_data: Json; p_entry_id: string }
        Returns: undefined
      }
      update_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: undefined
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

