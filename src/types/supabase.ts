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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      business_claims: {
        Row: {
          business_id: string
          claim_status: string | null
          created_at: string | null
          document_url: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          status: string
          submitted_documents: Json | null
          user_id: string
        }
        Insert: {
          business_id: string
          claim_status?: string | null
          created_at?: string | null
          document_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          status?: string
          submitted_documents?: Json | null
          user_id: string
        }
        Update: {
          business_id?: string
          claim_status?: string | null
          created_at?: string | null
          document_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          status?: string
          submitted_documents?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_claims_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_interactions: {
        Row: {
          business_id: string
          created_at: string
          id: string
          interaction_type: string
          profile_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          interaction_type?: string
          profile_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          interaction_type?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_interactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_interactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          category: string | null
          claimed_by: string | null
          complain_count: number | null
          complains: number | null
          created_at: string | null
          display_score: number | null
          external_url: string | null
          id: string
          is_shielded: boolean | null
          name: string | null
          recommend_count: number | null
          recommends: number | null
          region: string | null
          restriction_reason: string | null
          shadow_score: number | null
          shield_level: number | null
          source: string | null
          status: string | null
          total_votes: number | null
          trust_score: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          claimed_by?: string | null
          complain_count?: number | null
          complains?: number | null
          created_at?: string | null
          display_score?: number | null
          external_url?: string | null
          id?: string
          is_shielded?: boolean | null
          name?: string | null
          recommend_count?: number | null
          recommends?: number | null
          region?: string | null
          restriction_reason?: string | null
          shadow_score?: number | null
          shield_level?: number | null
          source?: string | null
          status?: string | null
          total_votes?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          claimed_by?: string | null
          complain_count?: number | null
          complains?: number | null
          created_at?: string | null
          display_score?: number | null
          external_url?: string | null
          id?: string
          is_shielded?: boolean | null
          name?: string | null
          recommend_count?: number | null
          recommends?: number | null
          region?: string | null
          restriction_reason?: string | null
          shadow_score?: number | null
          shield_level?: number | null
          source?: string | null
          status?: string | null
          total_votes?: number | null
          trust_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          allocated_coupons: number
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
          used_coupons: number
        }
        Insert: {
          allocated_coupons?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
          used_coupons?: number
        }
        Update: {
          allocated_coupons?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
          used_coupons?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          profile_id: string
          redeemed_at: string
        }
        Insert: {
          coupon_id: string
          id?: string
          profile_id: string
          redeemed_at?: string
        }
        Update: {
          coupon_id?: string
          id?: string
          profile_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "merchant_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          business_id: string
          created_at: string
          id: string
          log_id: number
          merchant_id: string
          reason: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          log_id: number
          merchant_id: string
          reason: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          log_id?: number
          merchant_id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          business_id: string | null
          created_at: string
          created_by: string | null
          id: string
          interaction_type: string | null
          is_verified: boolean | null
          reason_text: string | null
          receipt_url: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_type?: string | null
          is_verified?: boolean | null
          reason_text?: string | null
          receipt_url?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_type?: string | null
          is_verified?: boolean | null
          reason_text?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      log_votes: {
        Row: {
          created_at: string
          fingerprint: string | null
          id: string
          log_id: number
          profile_id: string | null
          vote_type: string
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          log_id: number
          profile_id?: string | null
          vote_type: string
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          log_id?: number
          profile_id?: string | null
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_votes_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          business_id: string | null
          created_at: string
          file_hash: string | null
          fingerprint: string | null
          helpful_votes: number | null
          id: number
          interaction_type: string
          profile_id: string | null
          reason_text: string | null
          status: string | null
          unhelpful_votes: number | null
          weight: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          file_hash?: string | null
          fingerprint?: string | null
          helpful_votes?: number | null
          id?: number
          interaction_type: string
          profile_id?: string | null
          reason_text?: string | null
          status?: string | null
          unhelpful_votes?: number | null
          weight?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          file_hash?: string | null
          fingerprint?: string | null
          helpful_votes?: number | null
          id?: number
          interaction_type?: string
          profile_id?: string | null
          reason_text?: string | null
          status?: string | null
          unhelpful_votes?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_coupons: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          discount_value: number | null
          distribution_rule: string
          expiry_date: string | null
          id: string
          initial_quantity: number
          item_name: string | null
          offer_type: string
          remaining_quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          discount_value?: number | null
          distribution_rule: string
          expiry_date?: string | null
          id?: string
          initial_quantity: number
          item_name?: string | null
          offer_type: string
          remaining_quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          discount_value?: number | null
          distribution_rule?: string
          expiry_date?: string | null
          id?: string
          initial_quantity?: number
          item_name?: string | null
          offer_type?: string
          remaining_quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_coupons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      platform_campaigns: {
        Row: {
          coupons_claimed: number | null
          coupons_pledged: number | null
          created_at: string
          end_date: string
          id: string
          participants: number | null
          start_date: string
          status: string
          title: string
        }
        Insert: {
          coupons_claimed?: number | null
          coupons_pledged?: number | null
          created_at?: string
          end_date: string
          id?: string
          participants?: number | null
          start_date: string
          status?: string
          title: string
        }
        Update: {
          coupons_claimed?: number | null
          coupons_pledged?: number | null
          created_at?: string
          end_date?: string
          id?: string
          participants?: number | null
          start_date?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      platform_coupon_pools: {
        Row: {
          amount: number
          created_at: string
          drop_logic: string
          id: string
          name: string
          remaining: number
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          drop_logic: string
          id?: string
          name: string
          remaining: number
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          drop_logic?: string
          id?: string
          name?: string
          remaining?: number
          type?: string
        }
        Relationships: []
      }
      pre_registrations: {
        Row: {
          business_name: string
          created_at: string
          id: string
          owner_name: string
          phone_number: string
          status: string | null
        }
        Insert: {
          business_name: string
          created_at?: string
          id?: string
          owner_name: string
          phone_number: string
          status?: string | null
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          owner_name?: string
          phone_number?: string
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_date: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          gader_points: number | null
          gender: string | null
          has_password: boolean | null
          id: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          vip_tier: string | null
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          gader_points?: number | null
          gender?: string | null
          has_password?: boolean | null
          id?: string
          phone: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
          vip_tier?: string | null
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          gader_points?: number | null
          gender?: string | null
          has_password?: boolean | null
          id?: string
          phone?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
          vip_tier?: string | null
        }
        Relationships: []
      }
      resolution_messages: {
        Row: {
          coupon_id: string | null
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolution_messages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "merchant_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "resolution_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      resolution_threads: {
        Row: {
          business_id: string
          consumer_id: string | null
          created_at: string
          id: string
          log_id: number
          merchant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          consumer_id?: string | null
          created_at?: string
          id?: string
          log_id: number
          merchant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          consumer_id?: string | null
          created_at?: string
          id?: string
          log_id?: number
          merchant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolution_threads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolution_threads_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          business_id: string
          created_at: string
          expires_at: string
          id: string
          status: string
          tier: string
        }
        Insert: {
          auto_renew?: boolean | null
          business_id: string
          created_at?: string
          expires_at: string
          id?: string
          status?: string
          tier: string
        }
        Update: {
          auto_renew?: boolean | null
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          duration: string
          id: string
          owner_id: string
          payment_method: string
          requested_tier: string
          screenshot_url: string | null
          status: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          duration?: string
          id?: string
          owner_id: string
          payment_method: string
          requested_tier: string
          screenshot_url?: string | null
          status?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          duration?: string
          id?: string
          owner_id?: string
          payment_method?: string
          requested_tier?: string
          screenshot_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_users: {
        Row: {
          id: string
          is_business_owner: boolean | null
          loyalty_points: number | null
          phone_number: string
          verification_date: string | null
        }
        Insert: {
          id: string
          is_business_owner?: boolean | null
          loyalty_points?: number | null
          phone_number: string
          verification_date?: string | null
        }
        Update: {
          id?: string
          is_business_owner?: boolean | null
          loyalty_points?: number | null
          phone_number?: string
          verification_date?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_confirm_payment: { Args: { p_txn_id: string }; Returns: undefined }
      admin_manage_user_gader: {
        Args: { p_amount: number; p_reason: string; p_user_id: string }
        Returns: undefined
      }
      admin_merge_businesses: {
        Args: { duplicate_uuid: string; master_uuid: string }
        Returns: undefined
      }
      admin_purge_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_resolve_claim: {
        Args: { p_claim_id: string; p_status: string }
        Returns: undefined
      }
      admin_resolve_dispute: {
        Args: { p_dispute_id: string; p_verdict: string }
        Returns: undefined
      }
      get_business_health_score: {
        Args: { business_uuid: string }
        Returns: number
      }
      get_business_stats: {
        Args: { business_uuid: string }
        Returns: {
          complains: number
          health_score: number
          recommends: number
          total_votes: number
        }[]
      }
    }
    Enums: {
      user_role: "user" | "merchant" | "admin"
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
      user_role: ["user", "merchant", "admin"],
    },
  },
} as const
