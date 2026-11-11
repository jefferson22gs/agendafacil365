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
      admin_notifications: {
        Row: {
          appointment_date: string | null
          appointment_id: string | null
          appointment_time: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          salon_id: string
          title: string
          type: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_id?: string | null
          appointment_time?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          salon_id: string
          title: string
          type: string
        }
        Update: {
          appointment_date?: string | null
          appointment_id?: string | null
          appointment_time?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          salon_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "admin_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "admin_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "admin_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      ai_platform_config: {
        Row: {
          base_prompt: string
          default_salon_monthly_requests: number | null
          default_salon_monthly_tokens: number | null
          enabled: boolean
          examples: Json
          fallback_message: string
          id: boolean
          knowledge: string
          max_tokens: number
          model: string
          model_family: string
          model_mode: string
          monthly_budget_usd: number | null
          on_limit: string
          price_cache_per_mtok: number | null
          price_in_per_mtok: number | null
          price_out_per_mtok: number | null
          provider: string
          resolved_at: string | null
          resolved_family: string | null
          resolved_model: string | null
          rules: string
          temperature: number
          thinking_level: string
          tone: string
          updated_at: string
          updated_by: string | null
          usd_brl: number
        }
        Insert: {
          base_prompt?: string
          default_salon_monthly_requests?: number | null
          default_salon_monthly_tokens?: number | null
          enabled?: boolean
          examples?: Json
          fallback_message?: string
          id?: boolean
          knowledge?: string
          max_tokens?: number
          model?: string
          model_family?: string
          model_mode?: string
          monthly_budget_usd?: number | null
          on_limit?: string
          price_cache_per_mtok?: number | null
          price_in_per_mtok?: number | null
          price_out_per_mtok?: number | null
          provider?: string
          resolved_at?: string | null
          resolved_family?: string | null
          resolved_model?: string | null
          rules?: string
          temperature?: number
          thinking_level?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
          usd_brl?: number
        }
        Update: {
          base_prompt?: string
          default_salon_monthly_requests?: number | null
          default_salon_monthly_tokens?: number | null
          enabled?: boolean
          examples?: Json
          fallback_message?: string
          id?: boolean
          knowledge?: string
          max_tokens?: number
          model?: string
          model_family?: string
          model_mode?: string
          monthly_budget_usd?: number | null
          on_limit?: string
          price_cache_per_mtok?: number | null
          price_in_per_mtok?: number | null
          price_out_per_mtok?: number | null
          provider?: string
          resolved_at?: string | null
          resolved_family?: string | null
          resolved_model?: string | null
          rules?: string
          temperature?: number
          thinking_level?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
          usd_brl?: number
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_reply_log: {
        Row: {
          created_at: string
          id: number
          kind: string
          salon_id: string
          source_event_id: string
          with_ai: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          salon_id: string
          source_event_id: string
          with_ai: boolean
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          salon_id?: string
          source_event_id?: string
          with_ai?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_reply_log_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_reply_log_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_reply_log_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_reply_log_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reply_log_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      ai_salon_limits: {
        Row: {
          blocked: boolean
          monthly_requests: number | null
          monthly_tokens: number | null
          note: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          monthly_requests?: number | null
          monthly_tokens?: number | null
          note?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          monthly_requests?: number | null
          monthly_tokens?: number | null
          note?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_salon_limits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_salon_limits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_salon_limits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_salon_limits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_salon_limits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          billable: boolean
          cost_usd: number
          created_at: string
          error_code: string | null
          feature: string
          id: number
          latency_ms: number | null
          model: string
          provider: string
          salon_id: string | null
          settled_at: string | null
          status: string
          tokens_cached: number
          tokens_in: number
          tokens_out: number
          tokens_thoughts: number
        }
        Insert: {
          billable?: boolean
          cost_usd?: number
          created_at?: string
          error_code?: string | null
          feature: string
          id?: number
          latency_ms?: number | null
          model: string
          provider: string
          salon_id?: string | null
          settled_at?: string | null
          status: string
          tokens_cached?: number
          tokens_in?: number
          tokens_out?: number
          tokens_thoughts?: number
        }
        Update: {
          billable?: boolean
          cost_usd?: number
          created_at?: string
          error_code?: string | null
          feature?: string
          id?: number
          latency_ms?: number | null
          model?: string
          provider?: string
          salon_id?: string | null
          settled_at?: string | null
          status?: string
          tokens_cached?: number
          tokens_in?: number
          tokens_out?: number
          tokens_thoughts?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_usage_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_usage_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "ai_usage_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      analytics_daily: {
        Row: {
          average_ticket: number | null
          cancelled_appointments: number | null
          completed_appointments: number | null
          created_at: string | null
          date: string
          id: string
          new_clients: number | null
          returning_clients: number | null
          salon_id: string
          top_professional_id: string | null
          top_service_id: string | null
          total_appointments: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          average_ticket?: number | null
          cancelled_appointments?: number | null
          completed_appointments?: number | null
          created_at?: string | null
          date: string
          id?: string
          new_clients?: number | null
          returning_clients?: number | null
          salon_id: string
          top_professional_id?: string | null
          top_service_id?: string | null
          total_appointments?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          average_ticket?: number | null
          cancelled_appointments?: number | null
          completed_appointments?: number | null
          created_at?: string | null
          date?: string
          id?: string
          new_clients?: number | null
          returning_clients?: number | null
          salon_id?: string
          top_professional_id?: string | null
          top_service_id?: string | null
          total_appointments?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "analytics_daily_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "analytics_daily_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "analytics_daily_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_daily_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "analytics_daily_top_professional_id_fkey"
            columns: ["top_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_daily_top_professional_id_fkey"
            columns: ["top_professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "analytics_daily_top_service_id_fkey"
            columns: ["top_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_payment_proofs: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          media_mime: string
          media_name: string
          media_path: string
          notes: string | null
          phone: string
          provider_message_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          salon_id: string
          status: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          media_mime: string
          media_name: string
          media_path: string
          notes?: string | null
          phone: string
          provider_message_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          salon_id: string
          status?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          media_mime?: string
          media_name?: string
          media_path?: string
          notes?: string | null
          phone?: string
          provider_message_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          salon_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_payment_proofs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_payment_proofs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_payment_proofs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointment_payment_proofs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointment_payment_proofs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointment_payment_proofs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_payment_proofs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      appointments: {
        Row: {
          can_be_modified: boolean | null
          cancellation_token: string | null
          cancelled_by: string | null
          client_birthday: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          coupon_id: string | null
          created_at: string
          date: string
          discount: number | null
          end_time: string
          final_price: number
          google_event_id: string | null
          google_sync_enabled: boolean | null
          google_synced_at: string | null
          id: string
          modified_at: string | null
          notes: string | null
          price: number
          professional_id: string | null
          return_days: number | null
          salon_id: string
          service_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          whatsapp_request_key: string | null
        }
        Insert: {
          can_be_modified?: boolean | null
          cancellation_token?: string | null
          cancelled_by?: string | null
          client_birthday?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          coupon_id?: string | null
          created_at?: string
          date: string
          discount?: number | null
          end_time: string
          final_price: number
          google_event_id?: string | null
          google_sync_enabled?: boolean | null
          google_synced_at?: string | null
          id?: string
          modified_at?: string | null
          notes?: string | null
          price: number
          professional_id?: string | null
          return_days?: number | null
          salon_id: string
          service_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          whatsapp_request_key?: string | null
        }
        Update: {
          can_be_modified?: boolean | null
          cancellation_token?: string | null
          cancelled_by?: string | null
          client_birthday?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          coupon_id?: string | null
          created_at?: string
          date?: string
          discount?: number | null
          end_time?: string
          final_price?: number
          google_event_id?: string | null
          google_sync_enabled?: boolean | null
          google_synced_at?: string | null
          id?: string
          modified_at?: string | null
          notes?: string | null
          price?: number
          professional_id?: string | null
          return_days?: number | null
          salon_id?: string
          service_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          whatsapp_request_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_messages: {
        Row: {
          broadcast_id: string
          created_at: string | null
          error_message: string | null
          id: string
          queue_id: string | null
          recipient_name: string | null
          recipient_phone: string
          salon_id: string
          sent_at: string | null
          status: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          broadcast_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          queue_id?: string | null
          recipient_name?: string | null
          recipient_phone: string
          salon_id: string
          sent_at?: string | null
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          broadcast_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          queue_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          salon_id?: string
          sent_at?: string | null
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_messages_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcast_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_messages_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_messages_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "broadcast_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      broadcast_queue: {
        Row: {
          attempts: number | null
          broadcast_id: string
          created_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          message: string
          outbox_id: string | null
          processed_at: string | null
          recipient_name: string | null
          recipient_phone: string
          salon_id: string
          scheduled_for: string | null
          status: string | null
          updated_at: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          attempts?: number | null
          broadcast_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message: string
          outbox_id?: string | null
          processed_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          salon_id: string
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          attempts?: number | null
          broadcast_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message?: string
          outbox_id?: string | null
          processed_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          salon_id?: string
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_queue_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcast_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_queue_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_queue_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      broadcast_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          name: string
          salon_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          name: string
          salon_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          salon_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcast_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          completed_at: string | null
          content_type: string
          created_at: string | null
          current_batch: number | null
          error_message: string | null
          failed_count: number | null
          id: string
          idempotency_key: string | null
          last_activity_at: string | null
          media_path: string | null
          message: string
          progress_percent: number | null
          salon_id: string
          scheduled_for: string | null
          sent_count: number | null
          status: string | null
          timezone: string
          total_batches: number | null
          total_recipients: number
        }
        Insert: {
          completed_at?: string | null
          content_type?: string
          created_at?: string | null
          current_batch?: number | null
          error_message?: string | null
          failed_count?: number | null
          id?: string
          idempotency_key?: string | null
          last_activity_at?: string | null
          media_path?: string | null
          message: string
          progress_percent?: number | null
          salon_id: string
          scheduled_for?: string | null
          sent_count?: number | null
          status?: string | null
          timezone?: string
          total_batches?: number | null
          total_recipients?: number
        }
        Update: {
          completed_at?: string | null
          content_type?: string
          created_at?: string | null
          current_batch?: number | null
          error_message?: string | null
          failed_count?: number | null
          id?: string
          idempotency_key?: string | null
          last_activity_at?: string | null
          media_path?: string | null
          message?: string
          progress_percent?: number | null
          salon_id?: string
          scheduled_for?: string | null
          sent_count?: number | null
          status?: string | null
          timezone?: string
          total_batches?: number | null
          total_recipients?: number
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          ai_response: boolean | null
          client_id: string | null
          client_name: string | null
          client_phone: string
          content: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          response_time_ms: number | null
          salon_id: string
          status: string | null
          tokens_used: number | null
          whatsapp_message_id: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_response?: boolean | null
          client_id?: string | null
          client_name?: string | null
          client_phone: string
          content: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          response_time_ms?: number | null
          salon_id: string
          status?: string | null
          tokens_used?: number | null
          whatsapp_message_id?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_response?: boolean | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string
          content?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          response_time_ms?: number | null
          salon_id?: string
          status?: string | null
          tokens_used?: number | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_conversations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_conversations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_conversations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_conversations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_conversations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      chatbot_knowledge_base: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          enabled: boolean | null
          id: string
          keywords: string[] | null
          priority: number | null
          question: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          keywords?: string[] | null
          priority?: number | null
          question: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          keywords?: string[] | null
          priority?: number | null
          question?: string
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_knowledge_base_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_knowledge_base_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_knowledge_base_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_knowledge_base_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_knowledge_base_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      chatbot_settings: {
        Row: {
          active_days: number[] | null
          active_hours_end: string | null
          active_hours_start: string | null
          ai_model: string | null
          ai_provider: string | null
          api_key: string | null
          bot_name: string | null
          created_at: string
          custom_instructions: string | null
          enabled: boolean | null
          fallback_message: string | null
          id: string
          max_tokens: number | null
          out_of_hours_message: string | null
          response_delay_ms: number | null
          salon_id: string
          system_prompt: string | null
          temperature: number | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          active_days?: number[] | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          api_key?: string | null
          bot_name?: string | null
          created_at?: string
          custom_instructions?: string | null
          enabled?: boolean | null
          fallback_message?: string | null
          id?: string
          max_tokens?: number | null
          out_of_hours_message?: string | null
          response_delay_ms?: number | null
          salon_id: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          active_days?: number[] | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          ai_model?: string | null
          ai_provider?: string | null
          api_key?: string | null
          bot_name?: string | null
          created_at?: string
          custom_instructions?: string | null
          enabled?: boolean | null
          fallback_message?: string | null
          id?: string
          max_tokens?: number | null
          out_of_hours_message?: string | null
          response_delay_ms?: number | null
          salon_id?: string
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "chatbot_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      client_credits: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          package_id: string | null
          remaining_uses: number
          salon_id: string
          service_id: string
          total_uses: number
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string | null
          remaining_uses?: number
          salon_id: string
          service_id: string
          total_uses?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string | null
          remaining_uses?: number
          salon_id?: string
          service_id?: string
          total_uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credits_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credits_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages_with_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_credits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_credits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_credits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credits_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_credits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_gallery: {
        Row: {
          after_image_url: string | null
          appointment_id: string | null
          before_image_url: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          professional_id: string | null
          salon_id: string
          service_id: string | null
          share_token: string | null
          visibility: string | null
        }
        Insert: {
          after_image_url?: string | null
          appointment_id?: string | null
          before_image_url?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          professional_id?: string | null
          salon_id: string
          service_id?: string | null
          share_token?: string | null
          visibility?: string | null
        }
        Update: {
          after_image_url?: string | null
          appointment_id?: string | null
          before_image_url?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          professional_id?: string | null
          salon_id?: string
          service_id?: string | null
          share_token?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_gallery_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_gallery_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_gallery_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_gallery_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_gallery_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "client_gallery_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_gallery_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_gallery_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_gallery_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_gallery_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_gallery_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_metrics: {
        Row: {
          avg_days_between_visits: number | null
          churn_risk: string | null
          client_id: string
          id: string
          last_visit_date: string | null
          ltv: number | null
          predicted_next_visit: string | null
          preferred_day_of_week: number | null
          preferred_professional_id: string | null
          preferred_time: string | null
          salon_id: string
          total_appointments: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          avg_days_between_visits?: number | null
          churn_risk?: string | null
          client_id: string
          id?: string
          last_visit_date?: string | null
          ltv?: number | null
          predicted_next_visit?: string | null
          preferred_day_of_week?: number | null
          preferred_professional_id?: string | null
          preferred_time?: string | null
          salon_id: string
          total_appointments?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          avg_days_between_visits?: number | null
          churn_risk?: string | null
          client_id?: string
          id?: string
          last_visit_date?: string | null
          ltv?: number | null
          predicted_next_visit?: string | null
          preferred_day_of_week?: number | null
          preferred_professional_id?: string | null
          preferred_time?: string | null
          salon_id?: string
          total_appointments?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_metrics_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_metrics_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "client_metrics_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_metrics_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_metrics_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_metrics_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_metrics_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          appointment_id: string | null
          client_name: string
          client_phone: string
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          salon_id: string
          title: string
          type: string
          whatsapp_sent: boolean | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          salon_id: string
          title: string
          type: string
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          salon_id?: string
          title?: string
          type?: string
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "client_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      clients: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          id: string
          last_visit_at: string | null
          loyalty_points: number
          marketing_consent_at: string | null
          marketing_opt_out: boolean
          name: string
          notes: string | null
          phone: string | null
          phone_normalized: string | null
          preferences: Json | null
          salon_id: string
          total_spent: number | null
          total_visits: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_visit_at?: string | null
          loyalty_points?: number
          marketing_consent_at?: string | null
          marketing_opt_out?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          preferences?: Json | null
          salon_id: string
          total_spent?: number | null
          total_visits?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_visit_at?: string | null
          loyalty_points?: number
          marketing_consent_at?: string | null
          marketing_opt_out?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          preferences?: Json | null
          salon_id?: string
          total_spent?: number | null
          total_visits?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          is_new_clients_only: boolean | null
          max_uses: number | null
          min_purchase: number | null
          salon_id: string
          type: Database["public"]["Enums"]["coupon_type"]
          uses_count: number | null
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_new_clients_only?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          salon_id: string
          type?: Database["public"]["Enums"]["coupon_type"]
          uses_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_new_clients_only?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          salon_id?: string
          type?: Database["public"]["Enums"]["coupon_type"]
          uses_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "coupons_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "coupons_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "coupons_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          end_date: string
          id: string
          name: string
          period: string | null
          professional_id: string | null
          salon_id: string
          start_date: string
          status: string | null
          target_value: number
          type: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          end_date: string
          id?: string
          name: string
          period?: string | null
          professional_id?: string | null
          salon_id: string
          start_date: string
          status?: string | null
          target_value: number
          type: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          end_date?: string
          id?: string
          name?: string
          period?: string | null
          professional_id?: string | null
          salon_id?: string
          start_date?: string
          status?: string | null
          target_value?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "goals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "goals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "goals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "goals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      google_calendar_settings: {
        Row: {
          auto_sync_enabled: boolean | null
          calendar_name: string | null
          created_at: string | null
          id: string
          reminder_minutes: number | null
          salon_id: string
          send_notifications: boolean | null
          sync_cancelled: boolean | null
          sync_direction: string | null
          updated_at: string | null
        }
        Insert: {
          auto_sync_enabled?: boolean | null
          calendar_name?: string | null
          created_at?: string | null
          id?: string
          reminder_minutes?: number | null
          salon_id: string
          send_notifications?: boolean | null
          sync_cancelled?: boolean | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_sync_enabled?: boolean | null
          calendar_name?: string | null
          created_at?: string | null
          id?: string
          reminder_minutes?: number | null
          salon_id?: string
          send_notifications?: boolean | null
          sync_cancelled?: boolean | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "google_calendar_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "google_calendar_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "google_calendar_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          refresh_token: string
          salon_id: string
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          refresh_token: string
          salon_id: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          refresh_token?: string
          salon_id?: string
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "google_calendar_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "google_calendar_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "google_calendar_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      infinitepay_orders: {
        Row: {
          amount_cents: number
          capture_method: string | null
          checkout_url: string | null
          created_at: string
          invoice_slug: string | null
          order_nsu: string
          paid_amount_cents: number | null
          paid_at: string | null
          plan: string
          receipt_url: string | null
          salon_id: string
          status: string
          subscription_id: string | null
          transaction_nsu: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          capture_method?: string | null
          checkout_url?: string | null
          created_at?: string
          invoice_slug?: string | null
          order_nsu: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          plan: string
          receipt_url?: string | null
          salon_id: string
          status?: string
          subscription_id?: string | null
          transaction_nsu?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          capture_method?: string | null
          checkout_url?: string | null
          created_at?: string
          invoice_slug?: string | null
          order_nsu?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          plan?: string
          receipt_url?: string | null
          salon_id?: string
          status?: string
          subscription_id?: string | null
          transaction_nsu?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "infinitepay_orders_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "infinitepay_orders_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "infinitepay_orders_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "infinitepay_orders_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infinitepay_orders_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "infinitepay_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_recipients: {
        Row: {
          created_at: string
          id: string
          phone: string
          salon_id: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          salon_id: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          salon_id?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_recipients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_recipients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_recipients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_recipients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_recipients_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      insights_reports: {
        Row: {
          created_at: string
          dedupe_key: string
          error_code: string | null
          id: string
          kind: string
          message: string
          metrics: Json
          outbox_id: string | null
          period_end: string
          period_start: string
          recipient_id: string | null
          salon_id: string
          status: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          error_code?: string | null
          id?: string
          kind: string
          message: string
          metrics: Json
          outbox_id?: string | null
          period_end: string
          period_start: string
          recipient_id?: string | null
          salon_id: string
          status?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          error_code?: string | null
          id?: string
          kind?: string
          message?: string
          metrics?: Json
          outbox_id?: string | null
          period_end?: string
          period_start?: string
          recipient_id?: string | null
          salon_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_reports_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_reports_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "insights_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      insights_settings: {
        Row: {
          alert_cancel_rate_pct: number
          alert_cooldown_days: number
          alert_drop_pct: number
          alert_growth_pct: number
          alerts_enabled: boolean
          monthly_enabled: boolean
          salon_id: string
          send_time: string
          show_professional_ranking: boolean
          updated_at: string
          weekly_day: number
          weekly_enabled: boolean
          yearly_enabled: boolean
        }
        Insert: {
          alert_cancel_rate_pct?: number
          alert_cooldown_days?: number
          alert_drop_pct?: number
          alert_growth_pct?: number
          alerts_enabled?: boolean
          monthly_enabled?: boolean
          salon_id: string
          send_time?: string
          show_professional_ranking?: boolean
          updated_at?: string
          weekly_day?: number
          weekly_enabled?: boolean
          yearly_enabled?: boolean
        }
        Update: {
          alert_cancel_rate_pct?: number
          alert_cooldown_days?: number
          alert_drop_pct?: number
          alert_growth_pct?: number
          alerts_enabled?: boolean
          monthly_enabled?: boolean
          salon_id?: string
          send_time?: string
          show_professional_ranking?: boolean
          updated_at?: string
          weekly_day?: number
          weekly_enabled?: boolean
          yearly_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "insights_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "insights_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      lookbook_items: {
        Row: {
          category: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string
          is_featured: boolean | null
          is_public: boolean | null
          likes_count: number | null
          professional_id: string | null
          salon_id: string
          service_id: string | null
          tags: string[] | null
          title: string | null
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url: string
          is_featured?: boolean | null
          is_public?: boolean | null
          likes_count?: number | null
          professional_id?: string | null
          salon_id: string
          service_id?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Update: {
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string
          is_featured?: boolean | null
          is_public?: boolean | null
          likes_count?: number | null
          professional_id?: string | null
          salon_id?: string
          service_id?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lookbook_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lookbook_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lookbook_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "lookbook_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "lookbook_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "lookbook_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "lookbook_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lookbook_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "lookbook_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      lookbook_likes: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          lookbook_item_id: string
          session_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          lookbook_item_id: string
          session_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          lookbook_item_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lookbook_likes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lookbook_likes_lookbook_item_id_fkey"
            columns: ["lookbook_item_id"]
            isOneToOne: false
            referencedRelation: "lookbook_items"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          client_id: string
          created_at: string | null
          current_tier_id: string | null
          id: string
          lifetime_points: number | null
          points: number | null
          salon_id: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          current_tier_id?: string | null
          id?: string
          lifetime_points?: number | null
          points?: number | null
          salon_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          current_tier_id?: string | null
          id?: string
          lifetime_points?: number | null
          points?: number | null
          salon_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_points_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_points_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_points_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      loyalty_redemptions: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          points_used: number
          reward_id: string | null
          salon_id: string
          status: string | null
          used_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          points_used: number
          reward_id?: string | null
          salon_id: string
          status?: string | null
          used_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          points_used?: number
          reward_id?: string | null
          salon_id?: string
          status?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          points_required: number
          salon_id: string
          stock: number | null
          type: string | null
          value: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          points_required: number
          salon_id: string
          stock?: number | null
          type?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          points_required?: number
          salon_id?: string
          stock?: number | null
          type?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_rewards_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_rewards_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_rewards_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          birthday_multiplier: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          points_per_real: number | null
          points_per_referral: number | null
          points_per_review: number | null
          salon_id: string
          updated_at: string | null
        }
        Insert: {
          birthday_multiplier?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          points_per_real?: number | null
          points_per_referral?: number | null
          points_per_review?: number | null
          salon_id: string
          updated_at?: string | null
        }
        Update: {
          birthday_multiplier?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          points_per_real?: number | null
          points_per_referral?: number | null
          points_per_review?: number | null
          salon_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          benefits: Json | null
          color: string | null
          created_at: string | null
          discount_percent: number | null
          icon: string | null
          id: string
          min_points: number
          name: string
          salon_id: string
          sort_order: number | null
        }
        Insert: {
          benefits?: Json | null
          color?: string | null
          created_at?: string | null
          discount_percent?: number | null
          icon?: string | null
          id?: string
          min_points: number
          name: string
          salon_id: string
          sort_order?: number | null
        }
        Update: {
          benefits?: Json | null
          color?: string | null
          created_at?: string | null
          discount_percent?: number | null
          icon?: string | null
          id?: string
          min_points?: number
          name?: string
          salon_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_tiers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_tiers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_tiers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_tiers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_tiers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          points: number
          reference_id: string | null
          reference_type: string | null
          salon_id: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          reference_type?: string | null
          salon_id: string
          type: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          salon_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          salon_id: string
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          salon_id: string
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          salon_id?: string
          type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "message_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "message_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "message_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          channel: string
          client_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          metadata: Json | null
          phone: string | null
          salon_id: string
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          title: string | null
          type: string
          whatsapp_outbox_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          channel: string
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          metadata?: Json | null
          phone?: string | null
          salon_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          title?: string | null
          type: string
          whatsapp_outbox_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          phone?: string | null
          salon_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          title?: string | null
          type?: string
          whatsapp_outbox_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "notifications_whatsapp_outbox_id_fkey"
            columns: ["whatsapp_outbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          client_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          package_id: string | null
          paid_at: string | null
          payment_method: string
          payment_status: string
          payment_type: string
          salon_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          package_id?: string | null
          paid_at?: string | null
          payment_method: string
          payment_status?: string
          payment_type?: string
          salon_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          package_id?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          payment_type?: string
          salon_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages_with_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      platform_contract_settings: {
        Row: {
          address: string | null
          city: string
          cnpj: string | null
          company_name: string | null
          email: string | null
          forum: string
          id: boolean
          platform_url: string
          preamble: string | null
          representative_cpf: string | null
          representative_name: string | null
          signer_email: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          city?: string
          cnpj?: string | null
          company_name?: string | null
          email?: string | null
          forum?: string
          id?: boolean
          platform_url?: string
          preamble?: string | null
          representative_cpf?: string | null
          representative_name?: string | null
          signer_email?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          cnpj?: string | null
          company_name?: string | null
          email?: string | null
          forum?: string
          id?: boolean
          platform_url?: string
          preamble?: string | null
          representative_cpf?: string | null
          representative_name?: string | null
          signer_email?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      procedure_return_alerts: {
        Row: {
          alert_date: string
          appointment_id: string
          channels_sent: Json
          claim_token: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          email_attempts: number
          email_first_attempt_at: string | null
          email_payload: Json | null
          id: string
          lease_until: string | null
          next_attempt_at: string
          notified_at: string | null
          notify_email: boolean
          notify_push: boolean
          notify_whatsapp: boolean
          performed_at: string
          procedure_name: string
          return_days: number
          salon_id: string
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alert_date: string
          appointment_id: string
          channels_sent?: Json
          claim_token?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          email_attempts?: number
          email_first_attempt_at?: string | null
          email_payload?: Json | null
          id?: string
          lease_until?: string | null
          next_attempt_at?: string
          notified_at?: string | null
          notify_email?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          performed_at: string
          procedure_name: string
          return_days: number
          salon_id: string
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alert_date?: string
          appointment_id?: string
          channels_sent?: Json
          claim_token?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          email_attempts?: number
          email_first_attempt_at?: string | null
          email_payload?: Json | null
          id?: string
          lease_until?: string | null
          next_attempt_at?: string
          notified_at?: string | null
          notify_email?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          performed_at?: string
          procedure_name?: string
          return_days?: number
          salon_id?: string
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_return_alerts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "procedure_return_alerts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          salon_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          salon_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          salon_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "product_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "product_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "product_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          salon_id: string
          stock: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          salon_id: string
          stock?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          salon_id?: string
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      professional_services: {
        Row: {
          custom_duration: number | null
          custom_price: number | null
          id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          custom_duration?: number | null
          custom_price?: number | null
          id?: string
          professional_id: string
          service_id: string
        }
        Update: {
          custom_duration?: number | null
          custom_price?: number | null
          id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          avatar_url: string | null
          bio: string | null
          commission_rate: number | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          is_active: boolean | null
          is_autonomous: boolean | null
          name: string
          phone: string | null
          portfolio_urls: Json | null
          public_booking_enabled: boolean | null
          public_profile_enabled: boolean | null
          salon_id: string
          slug: string | null
          specialty: string | null
          updated_at: string
          user_id: string | null
          working_days: number[] | null
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          is_autonomous?: boolean | null
          name: string
          phone?: string | null
          portfolio_urls?: Json | null
          public_booking_enabled?: boolean | null
          public_profile_enabled?: boolean | null
          salon_id: string
          slug?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
          working_days?: number[] | null
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          is_autonomous?: boolean | null
          name?: string
          phone?: string | null
          portfolio_urls?: Json | null
          public_booking_enabled?: boolean | null
          public_profile_enabled?: boolean | null
          salon_id?: string
          slug?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
          working_days?: number[] | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "professionals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "professionals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "professionals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_appointment_links: {
        Row: {
          appointment_id: string
          created_at: string
          subscription_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          subscription_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_appointment_links_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_appointment_links_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_appointment_links_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_outbox: {
        Row: {
          appointment_id: string | null
          attempts: number
          audience: string
          body: string
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          expires_at: string | null
          failed_count: number
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          salon_id: string
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          url: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          expires_at?: string | null
          failed_count?: number
          id?: string
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          salon_id: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          title: string
          url?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          expires_at?: string | null
          failed_count?: number
          id?: string
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          salon_id?: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      push_platform_status: {
        Row: {
          configured: boolean | null
          id: boolean
          last_error: string | null
          last_kick_at: string | null
          last_run_at: string | null
          last_success_at: string | null
          updated_at: string
        }
        Insert: {
          configured?: boolean | null
          id?: boolean
          last_error?: string | null
          last_kick_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Update: {
          configured?: boolean | null
          id?: boolean
          last_error?: string | null
          last_kick_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_preferences: {
        Row: {
          appointment_cancelled: boolean
          appointment_rescheduled: boolean
          client_reminder: boolean
          client_review_request: boolean
          client_status: boolean
          new_appointment: boolean
          new_review: boolean
          payment_proof: boolean
          reminder_minutes: number
          salon_id: string
          updated_at: string
          whatsapp_human: boolean
        }
        Insert: {
          appointment_cancelled?: boolean
          appointment_rescheduled?: boolean
          client_reminder?: boolean
          client_review_request?: boolean
          client_status?: boolean
          new_appointment?: boolean
          new_review?: boolean
          payment_proof?: boolean
          reminder_minutes?: number
          salon_id: string
          updated_at?: string
          whatsapp_human?: boolean
        }
        Update: {
          appointment_cancelled?: boolean
          appointment_rescheduled?: boolean
          client_reminder?: boolean
          client_review_request?: boolean
          client_status?: boolean
          new_appointment?: boolean
          new_review?: boolean
          payment_proof?: boolean
          reminder_minutes?: number
          salon_id?: string
          updated_at?: string
          whatsapp_human?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "push_preferences_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_preferences_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_preferences_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_preferences_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_preferences_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          client_id: string | null
          created_at: string
          deactivated_reason: string | null
          device_info: Json | null
          endpoint: string
          fcm_token: string | null
          id: string
          is_active: boolean | null
          marketing_opt_out: boolean
          p256dh: string | null
          salon_id: string
          updated_at: string
          user_id: string | null
          web_endpoint: string | null
        }
        Insert: {
          auth?: string | null
          client_id?: string | null
          created_at?: string
          deactivated_reason?: string | null
          device_info?: Json | null
          endpoint: string
          fcm_token?: string | null
          id?: string
          is_active?: boolean | null
          marketing_opt_out?: boolean
          p256dh?: string | null
          salon_id: string
          updated_at?: string
          user_id?: string | null
          web_endpoint?: string | null
        }
        Update: {
          auth?: string | null
          client_id?: string | null
          created_at?: string
          deactivated_reason?: string | null
          device_info?: Json | null
          endpoint?: string
          fcm_token?: string | null
          id?: string
          is_active?: boolean | null
          marketing_opt_out?: boolean
          p256dh?: string | null
          salon_id?: string
          updated_at?: string
          user_id?: string | null
          web_endpoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "push_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      pwa_installations: {
        Row: {
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          device_info: Json | null
          id: string
          installed_at: string | null
          is_active: boolean | null
          last_opened_at: string | null
          salon_id: string
          user_agent: string | null
        }
        Insert: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          device_info?: Json | null
          id?: string
          installed_at?: string | null
          is_active?: boolean | null
          last_opened_at?: string | null
          salon_id: string
          user_agent?: string | null
        }
        Update: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          device_info?: Json | null
          id?: string
          installed_at?: string | null
          is_active?: boolean | null
          last_opened_at?: string | null
          salon_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pwa_installations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "pwa_installations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "pwa_installations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "pwa_installations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pwa_installations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          client_id: string
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          salon_id: string
          uses_count: number | null
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          salon_id: string
          uses_count?: number | null
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          salon_id?: string
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referral_codes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referral_codes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referral_codes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          min_purchase_for_reward: number | null
          referee_reward_type: string | null
          referee_reward_value: number | null
          referrer_reward_type: string | null
          referrer_reward_value: number | null
          salon_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_purchase_for_reward?: number | null
          referee_reward_type?: string | null
          referee_reward_value?: number | null
          referrer_reward_type?: string | null
          referrer_reward_value?: number | null
          salon_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_purchase_for_reward?: number | null
          referee_reward_type?: string | null
          referee_reward_value?: number | null
          referrer_reward_type?: string | null
          referrer_reward_value?: number | null
          salon_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referral_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referral_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referral_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      referrals: {
        Row: {
          code_id: string | null
          created_at: string | null
          id: string
          referee_id: string
          referee_rewarded_at: string | null
          referrer_id: string
          referrer_rewarded_at: string | null
          salon_id: string
          status: string | null
        }
        Insert: {
          code_id?: string | null
          created_at?: string | null
          id?: string
          referee_id: string
          referee_rewarded_at?: string | null
          referrer_id: string
          referrer_rewarded_at?: string | null
          salon_id: string
          status?: string | null
        }
        Update: {
          code_id?: string | null
          created_at?: string | null
          id?: string
          referee_id?: string
          referee_rewarded_at?: string | null
          referrer_id?: string
          referrer_rewarded_at?: string | null
          salon_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referrals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referrals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "referrals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          client_id: string
          comment: string | null
          created_at: string
          id: string
          is_public: boolean | null
          professional_id: string
          rating: number
          response: string | null
          response_at: string | null
          salon_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean | null
          professional_id: string
          rating: number
          response?: string | null
          response_at?: string | null
          salon_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_public?: boolean | null
          professional_id?: string
          rating?: number
          response?: string | null
          response_at?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      saas_contract_events: {
        Row: {
          contract_id: string | null
          event_id: string
          payload: Json
          received_at: string
          type: string
        }
        Insert: {
          contract_id?: string | null
          event_id: string
          payload: Json
          received_at?: string
          type: string
        }
        Update: {
          contract_id?: string | null
          event_id?: string
          payload?: Json
          received_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "saas_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_contract_signers: {
        Row: {
          contract_id: string
          email: string
          id: string
          name: string
          public_id: string | null
          rejected_at: string | null
          role: string
          short_link: string | null
          signed_at: string | null
          signer_ip: string | null
          status: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          contract_id: string
          email: string
          id?: string
          name: string
          public_id?: string | null
          rejected_at?: string | null
          role: string
          short_link?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          contract_id?: string
          email?: string
          id?: string
          name?: string
          public_id?: string | null
          rejected_at?: string | null
          role?: string
          short_link?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_contract_signers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "saas_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_contracts: {
        Row: {
          autentique_document_id: string | null
          content_sha256: string
          content_text: string
          contract_data: Json
          contratada_signed_at: string | null
          contratante_signed_at: string | null
          created_at: string
          created_by: string
          error_code: string | null
          id: string
          pdf_sha256: string | null
          plan: string
          salon_id: string
          sandbox: boolean
          signed_at: string | null
          signed_file_url: string | null
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          autentique_document_id?: string | null
          content_sha256: string
          content_text: string
          contract_data: Json
          contratada_signed_at?: string | null
          contratante_signed_at?: string | null
          created_at?: string
          created_by: string
          error_code?: string | null
          id?: string
          pdf_sha256?: string | null
          plan: string
          salon_id: string
          sandbox?: boolean
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Update: {
          autentique_document_id?: string | null
          content_sha256?: string
          content_text?: string
          contract_data?: Json
          contratada_signed_at?: string | null
          contratante_signed_at?: string | null
          created_at?: string
          created_by?: string
          error_code?: string | null
          id?: string
          pdf_sha256?: string | null
          plan?: string
          salon_id?: string
          sandbox?: boolean
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_contracts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "saas_contracts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "saas_contracts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "saas_contracts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_contracts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      salon_ai_configs: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          provider: string
          salon_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider: string
          salon_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string
          salon_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_ai_configs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "ai_provider_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_ai_configs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_ai_configs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_ai_configs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_ai_configs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_ai_configs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      salon_groups: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          primary_color: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          primary_color?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_color?: string | null
        }
        Relationships: []
      }
      salon_insights: {
        Row: {
          action_data: Json | null
          action_type: string | null
          created_at: string
          expires_at: string | null
          id: string
          insight_type: string
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          priority: string | null
          salon_id: string
          title: string
        }
        Insert: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          insight_type: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          priority?: string | null
          salon_id: string
          title: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          insight_type?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          priority?: string | null
          salon_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_insights_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_insights_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_insights_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_insights_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_insights_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      salon_plans: {
        Row: {
          created_at: string
          custom_domain: string | null
          expires_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_professionals: number | null
          max_services: number | null
          plan_type: string
          price_monthly: number | null
          salon_id: string
          started_at: string | null
          white_label_enabled: boolean | null
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          expires_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_professionals?: number | null
          max_services?: number | null
          plan_type?: string
          price_monthly?: number | null
          salon_id: string
          started_at?: string | null
          white_label_enabled?: boolean | null
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          expires_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_professionals?: number | null
          max_services?: number | null
          plan_type?: string
          price_monthly?: number | null
          salon_id?: string
          started_at?: string | null
          white_label_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_plans_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_plans_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_plans_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_plans_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_plans_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          auto_birthday_messages: boolean | null
          auto_confirm_appointments: boolean | null
          auto_post_message: string | null
          auto_post_status_enabled: boolean | null
          auto_post_time: string | null
          auto_status_enabled: boolean | null
          auto_status_image_url: string | null
          auto_status_message: string | null
          birthday_discount_percent: number | null
          business_name: string | null
          city: string | null
          closing_time: string | null
          cnpj: string | null
          created_at: string
          description: string | null
          email: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          is_franchise: boolean | null
          last_auto_post_at: string | null
          logo_url: string | null
          lunch_break_config: Json | null
          name: string
          opening_time: string | null
          owner_id: string
          phone: string | null
          pix_key: string | null
          primary_color: string | null
          public_booking_enabled: boolean | null
          pwa_background_color: string | null
          pwa_description: string | null
          pwa_enabled: boolean | null
          pwa_icon_url: string | null
          pwa_name: string | null
          pwa_short_name: string | null
          pwa_theme_color: string | null
          seller_id: string | null
          slug: string | null
          state: string | null
          theme_color: string | null
          timezone: string
          updated_at: string
          whatsapp: string | null
          whatsapp_instance_name: string | null
          working_days: number[] | null
          working_hours: Json | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          auto_birthday_messages?: boolean | null
          auto_confirm_appointments?: boolean | null
          auto_post_message?: string | null
          auto_post_status_enabled?: boolean | null
          auto_post_time?: string | null
          auto_status_enabled?: boolean | null
          auto_status_image_url?: string | null
          auto_status_message?: string | null
          birthday_discount_percent?: number | null
          business_name?: string | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_franchise?: boolean | null
          last_auto_post_at?: string | null
          logo_url?: string | null
          lunch_break_config?: Json | null
          name: string
          opening_time?: string | null
          owner_id: string
          phone?: string | null
          pix_key?: string | null
          primary_color?: string | null
          public_booking_enabled?: boolean | null
          pwa_background_color?: string | null
          pwa_description?: string | null
          pwa_enabled?: boolean | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          pwa_short_name?: string | null
          pwa_theme_color?: string | null
          seller_id?: string | null
          slug?: string | null
          state?: string | null
          theme_color?: string | null
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
          whatsapp_instance_name?: string | null
          working_days?: number[] | null
          working_hours?: Json | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          auto_birthday_messages?: boolean | null
          auto_confirm_appointments?: boolean | null
          auto_post_message?: string | null
          auto_post_status_enabled?: boolean | null
          auto_post_time?: string | null
          auto_status_enabled?: boolean | null
          auto_status_image_url?: string | null
          auto_status_message?: string | null
          birthday_discount_percent?: number | null
          business_name?: string | null
          city?: string | null
          closing_time?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          is_franchise?: boolean | null
          last_auto_post_at?: string | null
          logo_url?: string | null
          lunch_break_config?: Json | null
          name?: string
          opening_time?: string | null
          owner_id?: string
          phone?: string | null
          pix_key?: string | null
          primary_color?: string | null
          public_booking_enabled?: boolean | null
          pwa_background_color?: string | null
          pwa_description?: string | null
          pwa_enabled?: boolean | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          pwa_short_name?: string | null
          pwa_theme_color?: string | null
          seller_id?: string | null
          slug?: string | null
          state?: string | null
          theme_color?: string | null
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
          whatsapp_instance_name?: string | null
          working_days?: number[] | null
          working_hours?: Json | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "salon_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salons_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "salons_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          anchor_day: number | null
          content_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          local_time: string | null
          media_filename: string | null
          media_mime: string | null
          media_path: string | null
          media_url: string | null
          outbox_id: string | null
          posted_at: string | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          salon_id: string
          scheduled_at: string
          status: string | null
          text_content: string | null
          timezone: string
          updated_at: string
          whatsapp_status_id: string | null
        }
        Insert: {
          anchor_day?: number | null
          content_type: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          local_time?: string | null
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_url?: string | null
          outbox_id?: string | null
          posted_at?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          salon_id: string
          scheduled_at: string
          status?: string | null
          text_content?: string | null
          timezone?: string
          updated_at?: string
          whatsapp_status_id?: string | null
        }
        Update: {
          anchor_day?: number | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          local_time?: string | null
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_url?: string | null
          outbox_id?: string | null
          posted_at?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          salon_id?: string
          scheduled_at?: string
          status?: string | null
          text_content?: string | null
          timezone?: string
          updated_at?: string
          whatsapp_status_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "scheduled_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "scheduled_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "scheduled_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      seller_commissions: {
        Row: {
          amount: number
          approved_at: string | null
          commission_amount: number
          commission_percent: number
          created_at: string
          id: string
          mp_payment_id: string | null
          notes: string | null
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          payment_type: string
          salon_id: string
          seller_id: string
          status: string
          subscription_id: string | null
          subscription_plan: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          commission_amount: number
          commission_percent: number
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_type: string
          salon_id: string
          seller_id: string
          status?: string
          subscription_id?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          id?: string
          mp_payment_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_type?: string
          salon_id?: string
          seller_id?: string
          status?: string
          subscription_id?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "subscription_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_commissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "seller_commissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "seller_commissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "seller_commissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_commissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "seller_commissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_stats"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_commissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          commission_annual_percent: number | null
          commission_monthly_percent: number | null
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          commission_annual_percent?: number | null
          commission_monthly_percent?: number | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          commission_annual_percent?: number | null
          commission_monthly_percent?: number | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      service_package_items: {
        Row: {
          created_at: string | null
          id: string
          package_id: string
          quantity: number | null
          service_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          package_id: string
          quantity?: number | null
          service_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          package_id?: string
          quantity?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages_with_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          quantity: number
          salon_id: string
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          quantity?: number
          salon_id: string
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          quantity?: number
          salon_id?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      services: {
        Row: {
          auto_return_alert: boolean
          created_at: string
          default_return_days: number | null
          description: string | null
          duration_minutes: number
          icon: string | null
          id: string
          insights_category: string | null
          is_active: boolean | null
          name: string
          notify_email: boolean
          notify_push: boolean
          notify_whatsapp: boolean
          price: number
          return_message_template: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          auto_return_alert?: boolean
          created_at?: string
          default_return_days?: number | null
          description?: string | null
          duration_minutes?: number
          icon?: string | null
          id?: string
          insights_category?: string | null
          is_active?: boolean | null
          name: string
          notify_email?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          price: number
          return_message_template?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          auto_return_alert?: boolean
          created_at?: string
          default_return_days?: number | null
          description?: string | null
          duration_minutes?: number
          icon?: string | null
          id?: string
          insights_category?: string | null
          is_active?: boolean | null
          name?: string
          notify_email?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          price?: number
          return_message_template?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      status_post_history: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          posted_at: string | null
          salon_id: string
          status: string | null
          whatsapp_status_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          posted_at?: string | null
          salon_id: string
          status?: string | null
          whatsapp_status_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          posted_at?: string | null
          salon_id?: string
          status?: string | null
          whatsapp_status_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_post_history_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "status_post_history_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "status_post_history_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "status_post_history_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_post_history_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          mp_payment_id: string | null
          mp_status: string | null
          mp_status_detail: string | null
          paid_at: string | null
          payment_method: string | null
          provider: string | null
          provider_payment_id: string | null
          salon_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          paid_at?: string | null
          payment_method?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          salon_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          paid_at?: string | null
          payment_method?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          salon_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "subscription_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "subscription_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "subscription_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number | null
          annual_amount: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          is_trial: boolean | null
          last_payment_date: string | null
          mp_external_reference: string | null
          mp_payer_id: string | null
          mp_preapproval_id: string | null
          next_payment_date: string | null
          payment_provider: string | null
          plan_id: string | null
          plan_name: string | null
          plan_type: string
          salon_id: string | null
          status: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          annual_amount?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_trial?: boolean | null
          last_payment_date?: string | null
          mp_external_reference?: string | null
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          next_payment_date?: string | null
          payment_provider?: string | null
          plan_id?: string | null
          plan_name?: string | null
          plan_type?: string
          salon_id?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          annual_amount?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          is_trial?: boolean | null
          last_payment_date?: string | null
          mp_external_reference?: string | null
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          next_payment_date?: string | null
          payment_provider?: string | null
          plan_id?: string | null
          plan_name?: string | null
          plan_type?: string
          salon_id?: string | null
          status?: string
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          salon_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          salon_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          salon_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "user_roles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "user_roles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "user_roles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      user_training_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          item_key: string
          item_version: number
          kind: string
          metadata: Json
          salon_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          item_key: string
          item_version?: number
          kind: string
          metadata?: Json
          salon_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          item_key?: string
          item_version?: number
          kind?: string
          metadata?: Json
          salon_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_training_progress_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "user_training_progress_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "user_training_progress_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "user_training_progress_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_training_progress_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      waitlist: {
        Row: {
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          id: string
          notes: string | null
          notified_at: string | null
          preferred_date: string | null
          preferred_time_end: string | null
          preferred_time_start: string | null
          priority: number | null
          professional_id: string | null
          salon_id: string
          scheduled_at: string | null
          service_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          preferred_date?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          priority?: number | null
          professional_id?: string | null
          salon_id: string
          scheduled_at?: string | null
          service_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          notified_at?: string | null
          preferred_date?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          priority?: number | null
          professional_id?: string | null
          salon_id?: string
          scheduled_at?: string | null
          service_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["professional_id"]
          },
          {
            foreignKeyName: "waitlist_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "waitlist_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "waitlist_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "waitlist_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automation_settings: {
        Row: {
          birthday_coupon_enabled: boolean
          birthday_coupon_validity_days: number
          birthday_enabled: boolean
          cancellation_enabled: boolean
          chatbot_booking_enabled: boolean
          confirmation_enabled: boolean
          guided_confirmation_message: string | null
          guided_flow_enabled: boolean
          guided_handoff_hours: number
          guided_info_text: string | null
          guided_render_mode: string
          guided_welcome_message: string | null
          interactive_enabled: boolean
          reminder_minutes: number[]
          reminders_enabled: boolean
          reschedule_enabled: boolean
          review_enabled: boolean
          salon_id: string
          updated_at: string
        }
        Insert: {
          birthday_coupon_enabled?: boolean
          birthday_coupon_validity_days?: number
          birthday_enabled?: boolean
          cancellation_enabled?: boolean
          chatbot_booking_enabled?: boolean
          confirmation_enabled?: boolean
          guided_confirmation_message?: string | null
          guided_flow_enabled?: boolean
          guided_handoff_hours?: number
          guided_info_text?: string | null
          guided_render_mode?: string
          guided_welcome_message?: string | null
          interactive_enabled?: boolean
          reminder_minutes?: number[]
          reminders_enabled?: boolean
          reschedule_enabled?: boolean
          review_enabled?: boolean
          salon_id: string
          updated_at?: string
        }
        Update: {
          birthday_coupon_enabled?: boolean
          birthday_coupon_validity_days?: number
          birthday_enabled?: boolean
          cancellation_enabled?: boolean
          chatbot_booking_enabled?: boolean
          confirmation_enabled?: boolean
          guided_confirmation_message?: string | null
          guided_flow_enabled?: boolean
          guided_handoff_hours?: number
          guided_info_text?: string | null
          guided_render_mode?: string
          guided_welcome_message?: string | null
          interactive_enabled?: boolean
          reminder_minutes?: number[]
          reminders_enabled?: boolean
          reschedule_enabled?: boolean
          review_enabled?: boolean
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_automation_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_automation_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_automation_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automation_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_chatbot_sessions: {
        Row: {
          client_name: string | null
          client_phone: string
          created_at: string
          current_step: string
          human_takeover_until: string | null
          id: string
          last_interaction_at: string
          salon_id: string
          session_data: Json
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_phone: string
          created_at?: string
          current_step?: string
          human_takeover_until?: string | null
          id?: string
          last_interaction_at?: string
          salon_id: string
          session_data?: Json
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_phone?: string
          created_at?: string
          current_step?: string
          human_takeover_until?: string | null
          id?: string
          last_interaction_at?: string
          salon_id?: string
          session_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chatbot_sessions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_sessions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_sessions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_sessions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chatbot_sessions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          api_key: string
          api_url: string
          created_at: string | null
          id: string
          instance_name: string
          is_active: boolean | null
          salon_id: string
        }
        Insert: {
          api_key: string
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name: string
          is_active?: boolean | null
          salon_id: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          is_active?: boolean | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_config_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_config_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_config_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_config_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_conversation_state: {
        Row: {
          human_takeover: boolean
          id: string
          last_read_at: string | null
          pending_action: Json | null
          pending_action_expires_at: string | null
          phone: string
          salon_id: string
          taken_over_at: string | null
          taken_over_by: string | null
          updated_at: string
        }
        Insert: {
          human_takeover?: boolean
          id?: string
          last_read_at?: string | null
          pending_action?: Json | null
          pending_action_expires_at?: string | null
          phone: string
          salon_id: string
          taken_over_at?: string | null
          taken_over_by?: string | null
          updated_at?: string
        }
        Update: {
          human_takeover?: boolean
          id?: string
          last_read_at?: string | null
          pending_action?: Json | null
          pending_action_expires_at?: string | null
          phone?: string
          salon_id?: string
          taken_over_at?: string | null
          taken_over_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_state_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_state_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_state_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_state_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_state_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          api_url: string | null
          created_at: string
          id: string
          instance_name: string
          instance_token: string | null
          meta_display_name: string | null
          meta_phone_number_id: string | null
          meta_quality: string | null
          meta_waba_id: string | null
          phone_number: string | null
          provider: string
          qrcode: string | null
          salon_id: string
          status: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name: string
          instance_token?: string | null
          meta_display_name?: string | null
          meta_phone_number_id?: string | null
          meta_quality?: string | null
          meta_waba_id?: string | null
          phone_number?: string | null
          provider?: string
          qrcode?: string | null
          salon_id: string
          status?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          meta_display_name?: string | null
          meta_phone_number_id?: string | null
          meta_quality?: string | null
          meta_waba_id?: string | null
          phone_number?: string | null
          provider?: string
          qrcode?: string | null
          salon_id?: string
          status?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_instances_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_instances_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_instances_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message_content: string
          message_type: string
          recipient_name: string | null
          recipient_phone: string
          salon_id: string
          sent_at: string | null
          status: string
          updated_at: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          message_type: string
          recipient_name?: string | null
          recipient_phone: string
          salon_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          message_type?: string
          recipient_name?: string | null
          recipient_phone?: string
          salon_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_marketing_suppression: {
        Row: {
          created_at: string
          phone: string
          salon_id: string
        }
        Insert: {
          created_at?: string
          phone: string
          salon_id: string
        }
        Update: {
          created_at?: string
          phone?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_marketing_suppression_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_marketing_suppression_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_marketing_suppression_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_marketing_suppression_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_marketing_suppression_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          author: string
          body: string
          client_ref: string | null
          contact_name: string | null
          created_at: string
          delivery_checks: number
          delivery_next_check_at: string | null
          direction: string
          error_code: string | null
          id: string
          kind: string
          legacy_conversation_id: string | null
          media_mime: string | null
          media_name: string | null
          media_url: string | null
          message_type: string
          outbox_id: string | null
          payload: Json | null
          phone: string
          provider_message_id: string | null
          salon_id: string
          sent_by: string | null
          source: string | null
          status: string
        }
        Insert: {
          author: string
          body?: string
          client_ref?: string | null
          contact_name?: string | null
          created_at?: string
          delivery_checks?: number
          delivery_next_check_at?: string | null
          direction: string
          error_code?: string | null
          id?: string
          kind?: string
          legacy_conversation_id?: string | null
          media_mime?: string | null
          media_name?: string | null
          media_url?: string | null
          message_type?: string
          outbox_id?: string | null
          payload?: Json | null
          phone: string
          provider_message_id?: string | null
          salon_id: string
          sent_by?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          author?: string
          body?: string
          client_ref?: string | null
          contact_name?: string | null
          created_at?: string
          delivery_checks?: number
          delivery_next_check_at?: string | null
          direction?: string
          error_code?: string | null
          id?: string
          kind?: string
          legacy_conversation_id?: string | null
          media_mime?: string | null
          media_name?: string | null
          media_url?: string | null
          message_type?: string
          outbox_id?: string | null
          payload?: Json | null
          phone?: string
          provider_message_id?: string | null
          salon_id?: string
          sent_by?: string | null
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_outbox: {
        Row: {
          appointment_id: string | null
          attempts: number
          category: string
          claim_token: string | null
          completed_at: string | null
          content_type: string
          created_at: string
          error_code: string | null
          expected_appointment_version: string | null
          id: string
          idempotency_key: string
          instance_id: string
          lease_until: string | null
          max_attempts: number
          media_filename: string | null
          media_mime: string | null
          media_path: string | null
          payload: Json | null
          recipient_phone: string | null
          remote_message_id: string | null
          salon_id: string
          scheduled_for: string
          send_started_at: string | null
          source_event_id: string | null
          status: string
          text_content: string
        }
        Insert: {
          appointment_id?: string | null
          attempts?: number
          category: string
          claim_token?: string | null
          completed_at?: string | null
          content_type?: string
          created_at?: string
          error_code?: string | null
          expected_appointment_version?: string | null
          id?: string
          idempotency_key: string
          instance_id: string
          lease_until?: string | null
          max_attempts?: number
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          payload?: Json | null
          recipient_phone?: string | null
          remote_message_id?: string | null
          salon_id: string
          scheduled_for?: string
          send_started_at?: string | null
          source_event_id?: string | null
          status?: string
          text_content?: string
        }
        Update: {
          appointment_id?: string | null
          attempts?: number
          category?: string
          claim_token?: string | null
          completed_at?: string | null
          content_type?: string
          created_at?: string
          error_code?: string | null
          expected_appointment_version?: string | null
          id?: string
          idempotency_key?: string
          instance_id?: string
          lease_until?: string | null
          max_attempts?: number
          media_filename?: string | null
          media_mime?: string | null
          media_path?: string | null
          payload?: Json | null
          recipient_phone?: string | null
          remote_message_id?: string | null
          salon_id?: string
          scheduled_for?: string
          send_started_at?: string | null
          source_event_id?: string | null
          status?: string
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_review_requests: {
        Row: {
          appointment_id: string
          comment_until: string | null
          phone: string
          requested_at: string
          review_id: string | null
          salon_id: string
        }
        Insert: {
          appointment_id: string
          comment_until?: string | null
          phone: string
          requested_at?: string
          review_id?: string | null
          salon_id: string
        }
        Update: {
          appointment_id?: string
          comment_until?: string | null
          phone?: string
          requested_at?: string
          review_id?: string | null
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_review_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_review_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "client_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_review_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_review_requests_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_review_requests_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_review_requests_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_review_requests_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_review_requests_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_status_posts: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          outbox_id: string | null
          posted_at: string
          salon_id: string
          status_image_url: string | null
          status_text: string
          success: boolean | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          outbox_id?: string | null
          posted_at?: string
          salon_id: string
          status_image_url?: string | null
          status_text: string
          success?: boolean | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          outbox_id?: string | null
          posted_at?: string
          salon_id?: string
          status_image_url?: string | null
          status_text?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_status_posts_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_status_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_status_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_status_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_status_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_status_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_status_runs: {
        Row: {
          completed_at: string | null
          error_code: string | null
          id: string
          outbox_id: string
          post_id: string
          remote_message_id: string | null
          salon_id: string
          scheduled_for: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_code?: string | null
          id?: string
          outbox_id: string
          post_id: string
          remote_message_id?: string | null
          salon_id: string
          scheduled_for: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_code?: string | null
          id?: string
          outbox_id?: string
          post_id?: string
          remote_message_id?: string | null
          salon_id?: string
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_status_runs_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_status_runs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_status_runs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_status_runs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_status_runs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_status_runs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_status_runs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          attempts: number
          claim_token: string | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          instance_id: string
          lease_until: string | null
          next_attempt_at: string
          payload: Json
          provider_message_id: string
          salon_id: string
          sender_phone: string
          status: string
          whatsapp_at: string | null
        }
        Insert: {
          attempts?: number
          claim_token?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          event_type: string
          id?: string
          instance_id: string
          lease_until?: string | null
          next_attempt_at?: string
          payload: Json
          provider_message_id: string
          salon_id: string
          sender_phone: string
          status?: string
          whatsapp_at?: string | null
        }
        Update: {
          attempts?: number
          claim_token?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          event_type?: string
          id?: string
          instance_id?: string
          lease_until?: string | null
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string
          salon_id?: string
          sender_phone?: string
          status?: string
          whatsapp_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_webhook_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
    }
    Views: {
      auto_post_stats: {
        Row: {
          auto_post_status_enabled: boolean | null
          auto_post_time: string | null
          failed_posts: number | null
          last_auto_post_at: string | null
          last_successful_post: string | null
          posts_last_30_days: number | null
          salon_id: string | null
          salon_name: string | null
          successful_posts: number | null
          total_posts: number | null
        }
        Relationships: []
      }
      broadcast_stats: {
        Row: {
          completed_at: string | null
          created_at: string | null
          failed_count: number | null
          id: string | null
          pending_count: number | null
          processing_count: number | null
          progress_percent: number | null
          salon_id: string | null
          seconds_since_activity: number | null
          sent_count: number | null
          status: string | null
          total_recipients: number | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      client_appointments: {
        Row: {
          can_modify: boolean | null
          cancellation_token: string | null
          client_name: string | null
          client_phone: string | null
          date: string | null
          end_time: string | null
          hours_until_appointment: number | null
          id: string | null
          price: number | null
          professional_name: string | null
          salon_address: string | null
          salon_name: string | null
          salon_phone: string | null
          service_name: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: []
      }
      google_calendar_sync_status: {
        Row: {
          auto_sync_enabled: boolean | null
          has_valid_token: boolean | null
          pending_sync: number | null
          salon_id: string | null
          salon_name: string | null
          sync_direction: string | null
          synced_appointments: number | null
          token_expires_at: string | null
          total_appointments: number | null
        }
        Relationships: []
      }
      pwa_stats: {
        Row: {
          active_installations: number | null
          active_users_7_days: number | null
          installations_last_30_days: number | null
          installations_last_7_days: number | null
          last_installation_at: string | null
          salon_id: string | null
          salon_name: string | null
          slug: string | null
          total_installations: number | null
        }
        Relationships: []
      }
      seller_stats: {
        Row: {
          active_salons: number | null
          commission_annual_percent: number | null
          commission_monthly_percent: number | null
          email: string | null
          is_active: boolean | null
          new_salons_30d: number | null
          phone: string | null
          seller_id: string | null
          seller_name: string | null
          total_paid: number | null
          total_pending: number | null
          total_salons: number | null
          total_to_pay: number | null
        }
        Relationships: []
      }
      service_packages_with_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percent: number | null
          id: string | null
          is_active: boolean | null
          items: Json | null
          name: string | null
          price: number | null
          quantity: number | null
          salon_id: string | null
          validity_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_packages_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
      weekly_schedule: {
        Row: {
          appointments: Json | null
          confirmed_count: number | null
          date: string | null
          day_name: string | null
          pending_count: number | null
          professional_id: string | null
          professional_name: string | null
          salon_id: string | null
          salon_name: string | null
          total_appointments: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      whatsapp_stats: {
        Row: {
          last_24h: number | null
          last_30days: number | null
          last_7days: number | null
          message_type: string | null
          salon_id: string | null
          status: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "auto_post_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_sync_status"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "pwa_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "weekly_schedule"
            referencedColumns: ["salon_id"]
          },
        ]
      }
    }
    Functions: {
      ai_log_reply: {
        Args: {
          p_event_id: string
          p_kind: string
          p_salon_id: string
          p_with_ai: boolean
        }
        Returns: undefined
      }
      ai_month_start: { Args: never; Returns: string }
      ai_platform_key_hints: {
        Args: never
        Returns: {
          last4: string
          provider: string
          updated_at: string
        }[]
      }
      ai_platform_secret: { Args: { p_provider: string }; Returns: string }
      ai_reserve: {
        Args: {
          p_cost: number
          p_feature: string
          p_model: string
          p_provider: string
          p_salon_id: string
          p_tokens: number
        }
        Returns: {
          reason: string
          reservation_id: number
        }[]
      }
      ai_save_platform_secret: {
        Args: { p_api_key: string; p_provider: string }
        Returns: undefined
      }
      ai_settle: {
        Args: {
          p_charged: boolean
          p_cost: number
          p_error_code: string
          p_exact: boolean
          p_id: number
          p_latency_ms: number
          p_status: string
          p_tokens_cached: number
          p_tokens_in: number
          p_tokens_out: number
          p_tokens_thoughts: number
        }
        Returns: boolean
      }
      ai_usage_report: {
        Args: {
          p_from: string
          p_group?: string
          p_salon_id?: string
          p_to: string
        }
        Returns: Json
      }
      ai_usage_summary: { Args: never; Returns: Json }
      block_expired_annual_subscriptions: { Args: never; Returns: number }
      calculate_client_metrics: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      calculate_commission: {
        Args: { p_amount: number; p_payment_type: string; p_seller_id: string }
        Returns: number
      }
      can_modify_appointment: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      cancel_appointment_by_token: {
        Args: { p_reason?: string; p_token: string }
        Returns: Json
      }
      check_and_process_scheduled_posts: { Args: never; Returns: undefined }
      check_birthday_notifications: { Args: never; Returns: undefined }
      check_broadcast_completion: { Args: never; Returns: undefined }
      cleanup_old_broadcast_queue: { Args: never; Returns: number }
      cleanup_system_logs: { Args: never; Returns: undefined }
      confirm_infinitepay_order: {
        Args: {
          p_capture_method?: string
          p_invoice_slug: string
          p_order_nsu: string
          p_paid_amount_cents: number
          p_transaction_nsu: string
        }
        Returns: Json
      }
      count_unread_notifications: {
        Args: { p_salon_id: string }
        Returns: number
      }
      expire_own_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      generate_cancellation_token: { Args: never; Returns: string }
      generate_salon_insights: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      generate_status_message: { Args: { p_salon_id: string }; Returns: string }
      get_available_slots_for_reschedule: {
        Args: { p_appointment_id: string; p_new_date: string }
        Returns: {
          is_available: boolean
          time_slot: string
        }[]
      }
      get_available_time_slots: {
        Args: {
          p_date: string
          p_exclude_appointment_id?: string
          p_professional_id: string
          p_salon_id: string
          p_service_id: string
        }
        Returns: string[]
      }
      get_birthday_clients: {
        Args: { p_salon_id: string }
        Returns: {
          age: number
          birth_date: string
          id: string
          name: string
          phone: string
        }[]
      }
      get_commissions_by_period: {
        Args: { p_end_date: string; p_seller_id?: string; p_start_date: string }
        Returns: {
          amount: number
          commission_amount: number
          commission_percent: number
          created_at: string
          paid_at: string
          payment_type: string
          salon_id: string
          salon_name: string
          seller_id: string
          seller_name: string
          status: string
        }[]
      }
      get_day_summary: {
        Args: { p_date: string; p_salon_id: string }
        Returns: Json
      }
      get_google_oauth_url: { Args: { p_salon_id: string }; Returns: string }
      get_my_ai_usage: {
        Args: never
        Returns: {
          blocked: boolean
          by_feature: Json
          limit_requests: number
          limit_tokens: number
          requests: number
          salon_id: string
          tokens: number
        }[]
      }
      get_pending_scheduled_posts: {
        Args: never
        Returns: {
          content_type: string
          instance_name: string
          media_url: string
          post_id: string
          salon_id: string
          text_content: string
        }[]
      }
      get_salon_analytics: {
        Args: { p_period?: string; p_salon_id: string }
        Returns: Json
      }
      get_salon_push_subscriptions: {
        Args: { p_salon_id: string }
        Returns: {
          auth: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }[]
      }
      get_salon_pwa_manifest: { Args: { p_salon_slug: string }; Returns: Json }
      get_schedule_grid: {
        Args: { p_date: string; p_professional_id: string; p_salon_id: string }
        Returns: {
          appointment_id: string
          client_name: string
          duration_minutes: number
          is_available: boolean
          service_name: string
          status: string
          time_slot: string
        }[]
      }
      get_seller_commission_summary: {
        Args: { p_seller_id?: string }
        Returns: {
          approved_commission_ids: string[]
          approved_count: number
          paid_count: number
          pending_commission_ids: string[]
          pending_count: number
          seller_id: string
          seller_name: string
          total_approved: number
          total_paid: number
          total_pending: number
        }[]
      }
      get_subscription_status: { Args: { p_salon_id: string }; Returns: Json }
      get_user_push_subscriptions: {
        Args: { p_user_id: string }
        Returns: {
          auth: string
          endpoint: string
          id: string
          p256dh: string
        }[]
      }
      get_user_salon_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insights_check_code: {
        Args: { p_code_hash: string; p_recipient_id: string }
        Returns: boolean
      }
      insights_dow_history: {
        Args: { p_salon_id: string; p_until: string; p_weeks?: number }
        Returns: Json
      }
      insights_metrics: {
        Args: { p_end: string; p_salon_id: string; p_start: string }
        Returns: Json
      }
      insights_set_code: {
        Args: { p_code_hash: string; p_recipient_id: string }
        Returns: undefined
      }
      invoke_edge_function: {
        Args: { p_body?: Json; p_function: string }
        Returns: number
      }
      is_google_token_valid: { Args: { p_salon_id: string }; Returns: boolean }
      is_subscription_active: { Args: { p_salon_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      link_web_push_appointment: {
        Args: { p_cancellation_token: string; p_endpoint: string }
        Returns: boolean
      }
      mark_all_notifications_as_read: {
        Args: { p_salon_id: string }
        Returns: undefined
      }
      mark_broadcast_queue_failed: {
        Args: { p_error_message: string; p_queue_id: string }
        Returns: undefined
      }
      mark_broadcast_queue_sent: {
        Args: { p_queue_id: string; p_whatsapp_message_id?: string }
        Returns: undefined
      }
      mark_payment_proof_status: {
        Args: { p_notes?: string; p_proof_id: string; p_status: string }
        Returns: boolean
      }
      mark_post_as_posted: {
        Args: { post_id: string; status_id?: string }
        Returns: undefined
      }
      mark_status_posted: { Args: { p_salon_id: string }; Returns: undefined }
      post_salon_status_auto: { Args: never; Returns: Json }
      procedure_return_claim: { Args: { p_id?: string }; Returns: Json }
      procedure_return_digits: { Args: { p: string }; Returns: string }
      procedure_return_finish: {
        Args: {
          p_claim: string
          p_email_id?: string
          p_email_status?: string
          p_id: string
        }
        Returns: boolean
      }
      procedure_return_owner_digest: { Args: never; Returns: number }
      procedure_return_prepare: {
        Args: {
          p_claim: string
          p_email?: Json
          p_id: string
          p_message: string
          p_url: string
        }
        Returns: Json
      }
      procedure_return_update: {
        Args: { p_alert_date?: string; p_id: string; p_status?: string }
        Returns: undefined
      }
      procedure_returns_kpis: { Args: { p_salon: string }; Returns: Json }
      procedure_returns_list: {
        Args: {
          p_client?: string
          p_from?: string
          p_salon: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          alert_date: string
          appointment_id: string
          channels_sent: Json
          client_email: string
          client_id: string
          client_name: string
          client_phone: string
          id: string
          notified_at: string
          performed_at: string
          procedure_name: string
          push_status: string
          return_days: number
          service_id: string
          status: string
          whatsapp_status: string
        }[]
      }
      process_auto_status_posts: {
        Args: never
        Returns: {
          instance_name: string
          message: string
          salon_id: string
          salon_name: string
        }[]
      }
      process_next_broadcast_queue_item: {
        Args: never
        Returns: {
          broadcast_id: string
          instance_name: string
          message: string
          queue_id: string
          recipient_phone: string
          salon_id: string
        }[]
      }
      push_assert_manager: { Args: { p_salon: string }; Returns: undefined }
      push_claim_outbox: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string | null
          attempts: number
          audience: string
          body: string
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          expires_at: string | null
          failed_count: number
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          salon_id: string
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "push_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      push_client_label: { Args: { p_name: string }; Returns: string }
      push_enqueue: {
        Args: {
          p_appointment?: string
          p_audience: string
          p_body: string
          p_dedupe: string
          p_expires?: string
          p_kind: string
          p_not_before?: string
          p_salon: string
          p_title: string
          p_url: string
        }
        Returns: boolean
      }
      push_enqueue_campaign: {
        Args: { p_body: string; p_salon_id: string; p_title: string }
        Returns: Json
      }
      push_enqueue_reminders: { Args: never; Returns: number }
      push_get_preferences: { Args: { p_salon_id: string }; Returns: Json }
      push_health: { Args: never; Returns: Json }
      push_job_targets: {
        Args: { p_job: string }
        Returns: {
          auth: string
          endpoint: string
          id: string
          p256dh: string
        }[]
      }
      push_kick: { Args: never; Returns: undefined }
      push_legacy_salons: { Args: { p_fcm_token: string }; Returns: string[] }
      push_manager_ids: { Args: { p_salon: string }; Returns: string[] }
      push_overview: { Args: { p_salon_id: string }; Returns: Json }
      push_pref_column: { Args: { p_kind: string }; Returns: string }
      push_salon_for_slug: {
        Args: { p_salon_slug: string }
        Returns: {
          address: string | null
          auto_birthday_messages: boolean | null
          auto_confirm_appointments: boolean | null
          auto_post_message: string | null
          auto_post_status_enabled: boolean | null
          auto_post_time: string | null
          auto_status_enabled: boolean | null
          auto_status_image_url: string | null
          auto_status_message: string | null
          birthday_discount_percent: number | null
          business_name: string | null
          city: string | null
          closing_time: string | null
          cnpj: string | null
          created_at: string
          description: string | null
          email: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          is_franchise: boolean | null
          last_auto_post_at: string | null
          logo_url: string | null
          lunch_break_config: Json | null
          name: string
          opening_time: string | null
          owner_id: string
          phone: string | null
          pix_key: string | null
          primary_color: string | null
          public_booking_enabled: boolean | null
          pwa_background_color: string | null
          pwa_description: string | null
          pwa_enabled: boolean | null
          pwa_icon_url: string | null
          pwa_name: string | null
          pwa_short_name: string | null
          pwa_theme_color: string | null
          seller_id: string | null
          slug: string | null
          state: string | null
          theme_color: string | null
          timezone: string
          updated_at: string
          whatsapp: string | null
          whatsapp_instance_name: string | null
          working_days: number[] | null
          working_hours: Json | null
          zip_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "salons"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      push_set_preferences: {
        Args: { p_prefs: Json; p_salon_id: string }
        Returns: Json
      }
      push_subscription_status: {
        Args: { p_fcm_token: string; p_salon_slug: string }
        Returns: boolean
      }
      push_valid_endpoint: { Args: { p: string }; Returns: boolean }
      push_when: { Args: { p_date: string; p_time: string }; Returns: string }
      register_push_subscription: {
        Args: { p_device?: Json; p_fcm_token: string; p_salon_slug: string }
        Returns: string
      }
      register_pwa_installation: {
        Args: {
          p_client_name?: string
          p_client_phone?: string
          p_device_info?: Json
          p_salon_id: string
          p_user_agent?: string
        }
        Returns: string
      }
      register_web_push: {
        Args: {
          p_auth: string
          p_device?: Json
          p_endpoint: string
          p_p256dh: string
          p_salon_slug: string
        }
        Returns: string
      }
      reschedule_appointment_by_token: {
        Args: { p_new_date: string; p_new_time: string; p_token: string }
        Returns: Json
      }
      saas_contract_apply_event: {
        Args: {
          p_event_id: string
          p_object: Json
          p_payload: Json
          p_type: string
        }
        Returns: boolean
      }
      save_chatbot_message: {
        Args: {
          p_ai_provider?: string
          p_ai_response?: boolean
          p_client_phone: string
          p_content: string
          p_direction: string
          p_salon_id: string
          p_tokens_used?: number
        }
        Returns: string
      }
      set_own_payment_reference: {
        Args: { p_subscription_id: string }
        Returns: string
      }
      should_post_status: { Args: { p_salon_id: string }; Returns: boolean }
      start_salon_trial: {
        Args: { p_salon_id: string }
        Returns: {
          amount: number | null
          annual_amount: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          is_trial: boolean | null
          last_payment_date: string | null
          mp_external_reference: string | null
          mp_payer_id: string | null
          mp_preapproval_id: string | null
          next_payment_date: string | null
          payment_provider: string | null
          plan_id: string | null
          plan_name: string | null
          plan_type: string
          salon_id: string | null
          status: string
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_public_review: {
        Args: { p_appointment_id: string; p_comment?: string; p_rating: number }
        Returns: Json
      }
      suggest_next_available_slot: {
        Args: {
          p_preferred_date?: string
          p_professional_id: string
          p_salon_id: string
          p_service_id: string
        }
        Returns: {
          days_from_now: number
          is_today: boolean
          suggested_date: string
          suggested_time: string
        }[]
      }
      trigger_scheduled_posts: { Args: never; Returns: undefined }
      unregister_push_subscription: {
        Args: { p_fcm_token: string; p_salon_slug: string }
        Returns: boolean
      }
      unregister_web_push: {
        Args: { p_endpoint: string; p_salon_slug: string }
        Returns: boolean
      }
      user_belongs_to_salon: { Args: { p_salon_id: string }; Returns: boolean }
      validate_appointment_availability: {
        Args: {
          p_date: string
          p_duration_minutes: number
          p_professional_id: string
          p_salon_id: string
          p_start_time: string
        }
        Returns: Json
      }
      web_push_set_marketing: {
        Args: { p_enabled: boolean; p_endpoint: string; p_salon_slug: string }
        Returns: boolean
      }
      web_push_status: {
        Args: { p_endpoint: string; p_salon_slug: string }
        Returns: Json
      }
      whatsapp_begin_send: {
        Args: { p_claim: string; p_id: string }
        Returns: boolean
      }
      whatsapp_book_appointment: {
        Args: {
          p_client_name: string
          p_date: string
          p_event_id: string
          p_professional_id: string
          p_request_key: string
          p_service_id: string
          p_start: string
        }
        Returns: string
      }
      whatsapp_book_appointment_v2: {
        Args: {
          p_birth_date: string
          p_client_name: string
          p_client_phone: string
          p_coupon_code: string
          p_date: string
          p_event_id: string
          p_professional_id: string
          p_request_key: string
          p_service_id: string
          p_start: string
        }
        Returns: Json
      }
      whatsapp_bridge_legacy_status: { Args: never; Returns: number }
      whatsapp_bridge_notifications: { Args: never; Returns: number }
      whatsapp_can_manage_salon: {
        Args: { p_salon_id: string }
        Returns: boolean
      }
      whatsapp_cancel_campaign: {
        Args: { p_campaign_id: string; p_salon_id: string }
        Returns: number
      }
      whatsapp_cancel_status: {
        Args: { p_post_id: string; p_salon_id: string }
        Returns: undefined
      }
      whatsapp_change_appointment: {
        Args: {
          p_action: string
          p_appointment_id: string
          p_date?: string
          p_event_id: string
          p_start?: string
        }
        Returns: string
      }
      whatsapp_chatbot_secret: {
        Args: { p_salon_id: string }
        Returns: {
          api_key: string
        }[]
      }
      whatsapp_claim_inbound: {
        Args: never
        Returns: {
          attempts: number
          claim_token: string | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          instance_id: string
          lease_until: string | null
          next_attempt_at: string
          payload: Json
          provider_message_id: string
          salon_id: string
          sender_phone: string
          status: string
          whatsapp_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_webhook_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      whatsapp_claim_outbox: {
        Args: never
        Returns: {
          appointment_id: string | null
          attempts: number
          category: string
          claim_token: string | null
          completed_at: string | null
          content_type: string
          created_at: string
          error_code: string | null
          expected_appointment_version: string | null
          id: string
          idempotency_key: string
          instance_id: string
          lease_until: string | null
          max_attempts: number
          media_filename: string | null
          media_mime: string | null
          media_path: string | null
          payload: Json | null
          recipient_phone: string | null
          remote_message_id: string | null
          salon_id: string
          scheduled_for: string
          send_started_at: string | null
          source_event_id: string | null
          status: string
          text_content: string
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      whatsapp_claim_outbox_v2: {
        Args: { p_chatbot_only?: boolean; p_source_event?: string }
        Returns: {
          appointment_id: string | null
          attempts: number
          category: string
          claim_token: string | null
          completed_at: string | null
          content_type: string
          created_at: string
          error_code: string | null
          expected_appointment_version: string | null
          id: string
          idempotency_key: string
          instance_id: string
          lease_until: string | null
          max_attempts: number
          media_filename: string | null
          media_mime: string | null
          media_path: string | null
          payload: Json | null
          recipient_phone: string | null
          remote_message_id: string | null
          salon_id: string
          scheduled_for: string
          send_started_at: string | null
          source_event_id: string | null
          status: string
          text_content: string
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      whatsapp_conversation_takeover: {
        Args: { p_pause: boolean; p_phone: string; p_salon_id: string }
        Returns: undefined
      }
      whatsapp_coupon_eval: {
        Args: {
          p_code: string
          p_phone: string
          p_salon_id: string
          p_total: number
        }
        Returns: {
          coupon_id: string
          discount: number
          reason: string
        }[]
      }
      whatsapp_create_campaign: {
        Args: {
          p_content_type?: string
          p_media_filename?: string
          p_media_mime?: string
          p_media_path?: string
          p_message: string
          p_recipients: Json
          p_salon_id: string
          p_scheduled_for: string
          p_submission: string
        }
        Returns: string
      }
      whatsapp_delivery_candidates: {
        Args: { p_limit?: number }
        Returns: {
          instance_id: string
          instance_name: string
          provider_message_id: string
          salon_id: string
        }[]
      }
      whatsapp_enqueue_birthdays: { Args: never; Returns: number }
      whatsapp_enqueue_confirmation: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      whatsapp_enqueue_due_status: { Args: never; Returns: number }
      whatsapp_enqueue_reminders: { Args: never; Returns: number }
      whatsapp_ensure_instance_secret: {
        Args: { p_instance_id: string }
        Returns: string
      }
      whatsapp_finish_inbound: {
        Args: {
          p_claim: string
          p_event_id: string
          p_model: string
          p_provider: string
          p_response: string
        }
        Returns: boolean
      }
      whatsapp_finish_inbound_v2: {
        Args: {
          p_claim: string
          p_event_id: string
          p_messages: Json
          p_model: string
          p_provider: string
        }
        Returns: boolean
      }
      whatsapp_finish_outbox: {
        Args: {
          p_claim: string
          p_error_code?: string
          p_id: string
          p_message_id?: string
          p_status: string
        }
        Returns: boolean
      }
      whatsapp_import_contacts: {
        Args: { p_contacts: Json; p_salon_id: string }
        Returns: Json
      }
      whatsapp_inbox_conversations: {
        Args: { p_limit?: number; p_salon_id: string }
        Returns: {
          contact_name: string
          human_takeover: boolean
          last_at: string
          last_author: string
          last_body: string
          last_direction: string
          last_kind: string
          last_type: string
          phone: string
          taken_over_at: string
          unread: number
        }[]
      }
      whatsapp_instance_secret: {
        Args: { p_instance_id: string }
        Returns: {
          instance_token: string
          webhook_secret: string
        }[]
      }
      whatsapp_mark_conversation_read: {
        Args: { p_phone: string; p_salon_id: string }
        Returns: undefined
      }
      whatsapp_next_status_time: {
        Args: {
          p_now: string
          p_post: Database["public"]["Tables"]["scheduled_posts"]["Row"]
        }
        Returns: string
      }
      whatsapp_record_delivery: {
        Args: {
          p_instance_id: string
          p_message_id: string
          p_salon_id: string
          p_status: string
        }
        Returns: undefined
      }
      whatsapp_reply_latency: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      whatsapp_reply_latency_v2: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      whatsapp_retry_outbox: {
        Args: { p_message_id: string; p_salon_id: string }
        Returns: boolean
      }
      whatsapp_review_comment: {
        Args: { p_comment: string; p_event_id: string }
        Returns: boolean
      }
      whatsapp_save_chatbot_secret: {
        Args: { p_api_key: string; p_salon_id: string }
        Returns: undefined
      }
      whatsapp_service_window_open: {
        Args: { p_phone: string; p_salon_id: string }
        Returns: boolean
      }
      whatsapp_set_marketing_opt_out: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      whatsapp_submit_review: {
        Args: { p_event_id: string; p_rating: number }
        Returns: Json
      }
      whatsapp_webhook_synced: {
        Args: { p_instance_id: string; p_mark?: boolean }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      coupon_type: "percentage" | "fixed"
      user_role: "admin" | "professional" | "client"
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
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      coupon_type: ["percentage", "fixed"],
      user_role: ["admin", "professional", "client"],
    },
  },
} as const
