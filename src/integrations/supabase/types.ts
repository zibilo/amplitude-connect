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
      account_status_cache: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          account_type: Database["public"]["Enums"]["account_type"]
          cle_rib: string
          code_banque: string
          code_guichet: string
          created_at: string
          date_cloture: string | null
          date_gel: string | null
          date_ouverture: string | null
          id: string
          id_societaire: string
          last_sync_at: string
          matricule_lie: string | null
          motif_gel: string | null
          nom_titulaire: string
          numero_compte: string
          oracle_source_id: string | null
          prenom_titulaire: string | null
          rib: string
          solde_disponible: number | null
          sync_hash: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          account_type?: Database["public"]["Enums"]["account_type"]
          cle_rib: string
          code_banque: string
          code_guichet: string
          created_at?: string
          date_cloture?: string | null
          date_gel?: string | null
          date_ouverture?: string | null
          id?: string
          id_societaire: string
          last_sync_at?: string
          matricule_lie?: string | null
          motif_gel?: string | null
          nom_titulaire: string
          numero_compte: string
          oracle_source_id?: string | null
          prenom_titulaire?: string | null
          rib: string
          solde_disponible?: number | null
          sync_hash?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          account_type?: Database["public"]["Enums"]["account_type"]
          cle_rib?: string
          code_banque?: string
          code_guichet?: string
          created_at?: string
          date_cloture?: string | null
          date_gel?: string | null
          date_ouverture?: string | null
          id?: string
          id_societaire?: string
          last_sync_at?: string
          matricule_lie?: string | null
          motif_gel?: string | null
          nom_titulaire?: string
          numero_compte?: string
          oracle_source_id?: string | null
          prenom_titulaire?: string | null
          rib?: string
          solde_disponible?: number | null
          sync_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      dry_run_results: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          comptes_bloques: number | null
          comptes_clos: number | null
          comptes_geles: number | null
          created_at: string
          details: Json | null
          erreurs_identite: number | null
          frais_estimes: number | null
          id: string
          import_id: string | null
          lignes_a_splitter: number
          lignes_rejetees: number
          lignes_valides: number
          montant_rejete: number | null
          montant_total: number | null
          montant_valide: number | null
          rejections_detail: Json | null
          rib_invalides: number | null
          routing_detail: Json | null
          run_timestamp: string
          splits_detail: Json | null
          total_lignes: number
          user_approved: boolean | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          comptes_bloques?: number | null
          comptes_clos?: number | null
          comptes_geles?: number | null
          created_at?: string
          details?: Json | null
          erreurs_identite?: number | null
          frais_estimes?: number | null
          id?: string
          import_id?: string | null
          lignes_a_splitter?: number
          lignes_rejetees?: number
          lignes_valides?: number
          montant_rejete?: number | null
          montant_total?: number | null
          montant_valide?: number | null
          rejections_detail?: Json | null
          rib_invalides?: number | null
          routing_detail?: Json | null
          run_timestamp?: string
          splits_detail?: Json | null
          total_lignes?: number
          user_approved?: boolean | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          comptes_bloques?: number | null
          comptes_clos?: number | null
          comptes_geles?: number | null
          created_at?: string
          details?: Json | null
          erreurs_identite?: number | null
          frais_estimes?: number | null
          id?: string
          import_id?: string | null
          lignes_a_splitter?: number
          lignes_rejetees?: number
          lignes_valides?: number
          montant_rejete?: number | null
          montant_total?: number | null
          montant_valide?: number | null
          rejections_detail?: Json | null
          rib_invalides?: number | null
          routing_detail?: Json | null
          run_timestamp?: string
          splits_detail?: Json | null
          total_lignes?: number
          user_approved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "dry_run_results_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_schedules: {
        Row: {
          compte_encaissement: string | null
          created_at: string
          destination: Database["public"]["Enums"]["routing_destination"] | null
          fee_code: string
          fee_name: string
          id: string
          is_active: boolean | null
          montant_fixe: number | null
          montant_maximum: number | null
          montant_minimum: number | null
          pourcentage: number | null
          type_operation: string | null
        }
        Insert: {
          compte_encaissement?: string | null
          created_at?: string
          destination?:
            | Database["public"]["Enums"]["routing_destination"]
            | null
          fee_code: string
          fee_name: string
          id?: string
          is_active?: boolean | null
          montant_fixe?: number | null
          montant_maximum?: number | null
          montant_minimum?: number | null
          pourcentage?: number | null
          type_operation?: string | null
        }
        Update: {
          compte_encaissement?: string | null
          created_at?: string
          destination?:
            | Database["public"]["Enums"]["routing_destination"]
            | null
          fee_code?: string
          fee_name?: string
          id?: string
          is_active?: boolean | null
          montant_fixe?: number | null
          montant_maximum?: number | null
          montant_minimum?: number | null
          pourcentage?: number | null
          type_operation?: string | null
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
      member_accounts: {
        Row: {
          accounts_verified: boolean | null
          created_at: string
          id: string
          id_societaire: string
          last_verification_at: string | null
          matricule: string
          rib_alternatif: string | null
          rib_courant: string | null
          rib_epargne: string | null
          split_percentage_courant: number | null
          split_percentage_epargne: number | null
          splitting_enabled: boolean | null
          updated_at: string
          verification_notes: string | null
        }
        Insert: {
          accounts_verified?: boolean | null
          created_at?: string
          id?: string
          id_societaire: string
          last_verification_at?: string | null
          matricule: string
          rib_alternatif?: string | null
          rib_courant?: string | null
          rib_epargne?: string | null
          split_percentage_courant?: number | null
          split_percentage_epargne?: number | null
          splitting_enabled?: boolean | null
          updated_at?: string
          verification_notes?: string | null
        }
        Update: {
          accounts_verified?: boolean | null
          created_at?: string
          id?: string
          id_societaire?: string
          last_verification_at?: string | null
          matricule?: string
          rib_alternatif?: string | null
          rib_courant?: string | null
          rib_epargne?: string | null
          split_percentage_courant?: number | null
          split_percentage_epargne?: number | null
          splitting_enabled?: boolean | null
          updated_at?: string
          verification_notes?: string | null
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
      preflight_validations: {
        Row: {
          account_status_found:
            | Database["public"]["Enums"]["account_status"]
            | null
          corrected_rib: string | null
          correction_applied: boolean | null
          correction_proposed: Json | null
          created_at: string
          error_code: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          id_societaire_found: string | null
          identity_check_passed: boolean | null
          identity_mismatch_details: string | null
          import_id: string | null
          matricule: string
          montant: number
          payroll_entry_id: string | null
          preflight_status: Database["public"]["Enums"]["preflight_status"]
          rib_source: string
        }
        Insert: {
          account_status_found?:
            | Database["public"]["Enums"]["account_status"]
            | null
          corrected_rib?: string | null
          correction_applied?: boolean | null
          correction_proposed?: Json | null
          created_at?: string
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          id_societaire_found?: string | null
          identity_check_passed?: boolean | null
          identity_mismatch_details?: string | null
          import_id?: string | null
          matricule: string
          montant: number
          payroll_entry_id?: string | null
          preflight_status: Database["public"]["Enums"]["preflight_status"]
          rib_source: string
        }
        Update: {
          account_status_found?:
            | Database["public"]["Enums"]["account_status"]
            | null
          corrected_rib?: string | null
          correction_applied?: boolean | null
          correction_proposed?: Json | null
          created_at?: string
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          id_societaire_found?: string | null
          identity_check_passed?: boolean | null
          identity_mismatch_details?: string | null
          import_id?: string | null
          matricule?: string
          montant?: number
          payroll_entry_id?: string | null
          preflight_status?: Database["public"]["Enums"]["preflight_status"]
          rib_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "preflight_validations_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preflight_validations_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
        ]
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
      product_codes: {
        Row: {
          code: string
          code_banque_associe: string | null
          code_guichet_associe: string | null
          created_at: string
          destination: Database["public"]["Enums"]["routing_destination"] | null
          fee_schedule_id: string | null
          frais_applicables: boolean | null
          id: string
          is_active: boolean | null
          libelle: string
        }
        Insert: {
          code: string
          code_banque_associe?: string | null
          code_guichet_associe?: string | null
          created_at?: string
          destination?:
            | Database["public"]["Enums"]["routing_destination"]
            | null
          fee_schedule_id?: string | null
          frais_applicables?: boolean | null
          id?: string
          is_active?: boolean | null
          libelle: string
        }
        Update: {
          code?: string
          code_banque_associe?: string | null
          code_guichet_associe?: string | null
          created_at?: string
          destination?:
            | Database["public"]["Enums"]["routing_destination"]
            | null
          fee_schedule_id?: string | null
          frais_applicables?: boolean | null
          id?: string
          is_active?: boolean | null
          libelle?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_codes_fee_schedule_id_fkey"
            columns: ["fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "fee_schedules"
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
      rib_corrections: {
        Row: {
          auto_corrected: boolean | null
          correction_reason: string | null
          correction_source: string
          created_at: string
          id: string
          import_id: string | null
          matricule: string
          payroll_entry_id: string | null
          rib_corrige: string
          rib_original: string
          user_validated: boolean | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          auto_corrected?: boolean | null
          correction_reason?: string | null
          correction_source: string
          created_at?: string
          id?: string
          import_id?: string | null
          matricule: string
          payroll_entry_id?: string | null
          rib_corrige: string
          rib_original: string
          user_validated?: boolean | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          auto_corrected?: boolean | null
          correction_reason?: string | null
          correction_source?: string
          created_at?: string
          id?: string
          import_id?: string | null
          matricule?: string
          payroll_entry_id?: string | null
          rib_corrige?: string
          rib_original?: string
          user_validated?: boolean | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rib_corrections_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rib_corrections_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          code_agence_source: string | null
          code_banque_cible: string
          code_compte_produit: string | null
          code_guichet_cible: string
          code_produit: string | null
          compte_commission: string | null
          created_at: string
          destination: Database["public"]["Enums"]["routing_destination"]
          employeur_code: string | null
          frais_fixes: number | null
          frais_pourcentage: number | null
          id: string
          is_active: boolean | null
          priority: number | null
          rule_name: string
          updated_at: string
        }
        Insert: {
          code_agence_source?: string | null
          code_banque_cible: string
          code_compte_produit?: string | null
          code_guichet_cible: string
          code_produit?: string | null
          compte_commission?: string | null
          created_at?: string
          destination: Database["public"]["Enums"]["routing_destination"]
          employeur_code?: string | null
          frais_fixes?: number | null
          frais_pourcentage?: number | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name: string
          updated_at?: string
        }
        Update: {
          code_agence_source?: string | null
          code_banque_cible?: string
          code_compte_produit?: string | null
          code_guichet_cible?: string
          code_produit?: string | null
          compte_commission?: string | null
          created_at?: string
          destination?: Database["public"]["Enums"]["routing_destination"]
          employeur_code?: string | null
          frais_fixes?: number | null
          frais_pourcentage?: number | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      split_transactions: {
        Row: {
          created_at: string
          id: string
          id_societaire_courant: string
          id_societaire_epargne: string
          identity_verified: boolean
          import_id: string | null
          matricule: string
          montant_courant: number
          montant_epargne: number
          montant_total: number
          payroll_entry_id: string | null
          processed_at: string | null
          rib_courant: string
          rib_epargne: string
          splitting_rule_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          id_societaire_courant: string
          id_societaire_epargne: string
          identity_verified?: boolean
          import_id?: string | null
          matricule: string
          montant_courant: number
          montant_epargne: number
          montant_total: number
          payroll_entry_id?: string | null
          processed_at?: string | null
          rib_courant: string
          rib_epargne: string
          splitting_rule_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          id_societaire_courant?: string
          id_societaire_epargne?: string
          identity_verified?: boolean
          import_id?: string | null
          matricule?: string
          montant_courant?: number
          montant_epargne?: number
          montant_total?: number
          payroll_entry_id?: string | null
          processed_at?: string | null
          rib_courant?: string
          rib_epargne?: string
          splitting_rule_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "split_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_transactions_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_transactions_splitting_rule_id_fkey"
            columns: ["splitting_rule_id"]
            isOneToOne: false
            referencedRelation: "splitting_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      splitting_rules: {
        Row: {
          created_at: string
          created_by: string | null
          employeur_code: string | null
          id: string
          id_societaire: string | null
          identity_verified: boolean | null
          is_active: boolean | null
          matricule: string | null
          montant_minimum_split: number | null
          percentage_courant: number
          percentage_epargne: number
          priority: number | null
          rib_courant_cible: string | null
          rib_epargne_cible: string | null
          rule_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employeur_code?: string | null
          id?: string
          id_societaire?: string | null
          identity_verified?: boolean | null
          is_active?: boolean | null
          matricule?: string | null
          montant_minimum_split?: number | null
          percentage_courant?: number
          percentage_epargne?: number
          priority?: number | null
          rib_courant_cible?: string | null
          rib_epargne_cible?: string | null
          rule_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employeur_code?: string | null
          id?: string
          id_societaire?: string | null
          identity_verified?: boolean | null
          is_active?: boolean | null
          matricule?: string | null
          montant_minimum_split?: number | null
          percentage_courant?: number
          percentage_epargne?: number
          priority?: number | null
          rib_courant_cible?: string | null
          rib_epargne_cible?: string | null
          rule_name?: string
          updated_at?: string
        }
        Relationships: []
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
      apply_salary_split: {
        Args: {
          p_import_id: string
          p_matricule: string
          p_montant_total: number
          p_payroll_entry_id: string
        }
        Returns: string
      }
      batch_insert_entries: {
        Args: { p_entries: Json; p_import_id: string }
        Returns: number
      }
      batch_preflight_validate: {
        Args: { p_import_id: string }
        Returns: {
          total_rejected: number
          total_valid: number
          total_validated: number
        }[]
      }
      calculate_import_stats: {
        Args: { p_import_id: string }
        Returns: undefined
      }
      calculate_transfer_fees: {
        Args: {
          p_destination: Database["public"]["Enums"]["routing_destination"]
          p_montant: number
        }
        Returns: {
          frais_fixes: number
          frais_total: number
          frais_variables: number
          montant_net: number
        }[]
      }
      check_account_status: {
        Args: { p_rib: string }
        Returns: {
          id_societaire: string
          is_valid: boolean
          nom_titulaire: string
          rejection_reason: string
          status: Database["public"]["Enums"]["account_status"]
        }[]
      }
      cross_check_entry: {
        Args: { p_matricule: string; p_montant: number; p_rib: string }
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          error_messages: string[]
          estimated_fees: number
          has_splitting_rule: boolean
          is_valid: boolean
          needs_rib_correction: boolean
          proposed_rib: string
          routing_destination: Database["public"]["Enums"]["routing_destination"]
          split_percentage_courant: number
          split_percentage_epargne: number
        }[]
      }
      execute_dry_run: { Args: { p_import_id: string }; Returns: string }
      get_routing_rule: {
        Args: { p_code_agence?: string; p_employeur_code: string }
        Returns: {
          code_banque_cible: string
          code_guichet_cible: string
          destination: Database["public"]["Enums"]["routing_destination"]
          frais_fixes: number
          frais_pourcentage: number
        }[]
      }
      preflight_validate_entry: {
        Args: {
          p_import_id: string
          p_matricule: string
          p_montant: number
          p_payroll_entry_id: string
          p_rib: string
        }
        Returns: string
      }
      propose_rib_correction: {
        Args: { p_matricule: string; p_rib_invalid: string }
        Returns: {
          account_holder: string
          corrected_rib: string
          correction_reason: string
          has_correction: boolean
        }[]
      }
      verify_split_identity: {
        Args: {
          p_matricule: string
          p_rib_courant: string
          p_rib_epargne: string
        }
        Returns: {
          id_societaire_courant: string
          id_societaire_epargne: string
          identity_match: boolean
          mismatch_details: string
        }[]
      }
    }
    Enums: {
      account_status:
        | "ACTIF"
        | "GELE"
        | "CLOS"
        | "BLOQUE"
        | "SAISIE_ATTRIBUTION"
        | "DORMANT"
        | "SUSPENDU"
      account_type: "COURANT" | "EPARGNE" | "DAT" | "CREDIT" | "SPECIAL"
      preflight_status:
        | "VALID"
        | "REJECTED_FROZEN"
        | "REJECTED_CLOSED"
        | "REJECTED_BLOCKED"
        | "REJECTED_RIB_INVALID"
        | "REJECTED_IDENTITY_MISMATCH"
        | "PENDING_CORRECTION"
        | "CORRECTED"
      routing_destination:
        | "CLM"
        | "CAISSE_FEDERALE"
        | "AGENCE_LOCALE"
        | "EXTERNE"
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
      account_status: [
        "ACTIF",
        "GELE",
        "CLOS",
        "BLOQUE",
        "SAISIE_ATTRIBUTION",
        "DORMANT",
        "SUSPENDU",
      ],
      account_type: ["COURANT", "EPARGNE", "DAT", "CREDIT", "SPECIAL"],
      preflight_status: [
        "VALID",
        "REJECTED_FROZEN",
        "REJECTED_CLOSED",
        "REJECTED_BLOCKED",
        "REJECTED_RIB_INVALID",
        "REJECTED_IDENTITY_MISMATCH",
        "PENDING_CORRECTION",
        "CORRECTED",
      ],
      routing_destination: [
        "CLM",
        "CAISSE_FEDERALE",
        "AGENCE_LOCALE",
        "EXTERNE",
      ],
    },
  },
} as const
