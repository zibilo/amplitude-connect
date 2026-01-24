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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          session_id: string | null
          severity: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          session_id?: string | null
          severity?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      generated_files: {
        Row: {
          created_at: string
          destination_path: string | null
          entries_count: number
          file_content: string | null
          file_format: string
          file_hash: string | null
          file_name: string
          file_type: string
          id: string
          import_id: string | null
          total_amount: number
          transfer_status: string | null
          transferred_at: string | null
        }
        Insert: {
          created_at?: string
          destination_path?: string | null
          entries_count?: number
          file_content?: string | null
          file_format: string
          file_hash?: string | null
          file_name: string
          file_type: string
          id?: string
          import_id?: string | null
          total_amount?: number
          transfer_status?: string | null
          transferred_at?: string | null
        }
        Update: {
          created_at?: string
          destination_path?: string | null
          entries_count?: number
          file_content?: string | null
          file_format?: string
          file_hash?: string | null
          file_name?: string
          file_type?: string
          id?: string
          import_id?: string | null
          total_amount?: number
          transfer_status?: string | null
          transferred_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_files_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      matricule_cache: {
        Row: {
          first_seen_at: string
          id: string
          last_seen_at: string
          matricule: string
          occurrence_count: number | null
        }
        Insert: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          matricule: string
          occurrence_count?: number | null
        }
        Update: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          matricule?: string
          occurrence_count?: number | null
        }
        Relationships: []
      }
      payroll_entries: {
        Row: {
          account_exists: boolean | null
          batch_number: number | null
          cle_rib: string | null
          code_banque: string | null
          code_guichet: string | null
          created_at: string
          id: string
          import_id: string
          matricule: string
          montant: number
          nom: string
          numero_compte: string | null
          prenom: string | null
          rejection_reason: string | null
          rib: string
          rib_error: string | null
          rib_valid: boolean | null
          status: string
        }
        Insert: {
          account_exists?: boolean | null
          batch_number?: number | null
          cle_rib?: string | null
          code_banque?: string | null
          code_guichet?: string | null
          created_at?: string
          id?: string
          import_id: string
          matricule: string
          montant: number
          nom: string
          numero_compte?: string | null
          prenom?: string | null
          rejection_reason?: string | null
          rib: string
          rib_error?: string | null
          rib_valid?: boolean | null
          status?: string
        }
        Update: {
          account_exists?: boolean | null
          batch_number?: number | null
          cle_rib?: string | null
          code_banque?: string | null
          code_guichet?: string | null
          created_at?: string
          id?: string
          import_id?: string
          matricule?: string
          montant?: number
          nom?: string
          numero_compte?: string | null
          prenom?: string | null
          rejection_reason?: string | null
          rib?: string
          rib_error?: string | null
          rib_valid?: boolean | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_imports: {
        Row: {
          created_at: string
          error_message: string | null
          file_hash: string | null
          file_name: string
          file_size: number | null
          id: string
          invalid_entries: number | null
          processing_completed_at: string | null
          processing_started_at: string | null
          status: string
          total_amount: number | null
          total_entries: number | null
          updated_at: string
          valid_entries: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          invalid_entries?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
          total_amount?: number | null
          total_entries?: number | null
          updated_at?: string
          valid_entries?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          invalid_entries?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
          total_amount?: number | null
          total_entries?: number | null
          updated_at?: string
          valid_entries?: number | null
        }
        Relationships: []
      }
      processing_stats: {
        Row: {
          batch_number: number | null
          created_at: string
          id: string
          import_id: string | null
          memory_used_mb: number | null
          processing_time_ms: number | null
          rows_invalid: number | null
          rows_processed: number | null
          rows_valid: number | null
        }
        Insert: {
          batch_number?: number | null
          created_at?: string
          id?: string
          import_id?: string | null
          memory_used_mb?: number | null
          processing_time_ms?: number | null
          rows_invalid?: number | null
          rows_processed?: number | null
          rows_valid?: number | null
        }
        Update: {
          batch_number?: number | null
          created_at?: string
          id?: string
          import_id?: string | null
          memory_used_mb?: number | null
          processing_time_ms?: number | null
          rows_invalid?: number | null
          rows_processed?: number | null
          rows_valid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_stats_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_entries: {
        Row: {
          code_rejet: string | null
          created_at: string
          date_compensation: string | null
          id: string
          montant_envoye: number
          montant_recu: number | null
          motif_rejet: string | null
          nom: string | null
          payroll_entry_id: string | null
          report_id: string
          rib: string
          status: string
        }
        Insert: {
          code_rejet?: string | null
          created_at?: string
          date_compensation?: string | null
          id?: string
          montant_envoye: number
          montant_recu?: number | null
          motif_rejet?: string | null
          nom?: string | null
          payroll_entry_id?: string | null
          report_id: string
          rib: string
          status?: string
        }
        Update: {
          code_rejet?: string | null
          created_at?: string
          date_compensation?: string | null
          id?: string
          montant_envoye?: number
          montant_recu?: number | null
          motif_rejet?: string | null
          nom?: string | null
          payroll_entry_id?: string | null
          report_id?: string
          rib?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_entries_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_reports: {
        Row: {
          created_at: string
          entries_count: number | null
          file_hash: string | null
          file_name: string
          id: string
          import_date: string
          linked_import_id: string | null
          matched_count: number | null
          status: string | null
          success_rate: number | null
          total_received: number | null
          total_rejected: number | null
          total_sent: number | null
          unmatched_count: number | null
        }
        Insert: {
          created_at?: string
          entries_count?: number | null
          file_hash?: string | null
          file_name: string
          id?: string
          import_date?: string
          linked_import_id?: string | null
          matched_count?: number | null
          status?: string | null
          success_rate?: number | null
          total_received?: number | null
          total_rejected?: number | null
          total_sent?: number | null
          unmatched_count?: number | null
        }
        Update: {
          created_at?: string
          entries_count?: number | null
          file_hash?: string | null
          file_name?: string
          id?: string
          import_date?: string
          linked_import_id?: string | null
          matched_count?: number | null
          status?: string | null
          success_rate?: number | null
          total_received?: number | null
          total_rejected?: number | null
          total_sent?: number | null
          unmatched_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_reports_linked_import_id_fkey"
            columns: ["linked_import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      batch_insert_entries: {
        Args: { p_entries: Json; p_import_id: string }
        Returns: number
      }
      calculate_import_stats: {
        Args: { p_import_id: string }
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
    Enums: {},
  },
} as const
