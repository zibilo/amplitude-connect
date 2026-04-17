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
      caisses: {
        Row: {
          code_caisse: string
          created_at: string | null
          id: string
          is_active: boolean | null
          nom_caisse: string
          zone_region: string | null
        }
        Insert: {
          code_caisse: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nom_caisse: string
          zone_region?: string | null
        }
        Update: {
          code_caisse?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          nom_caisse?: string
          zone_region?: string | null
        }
        Relationships: []
      }
      clm_agency_codes: {
        Row: {
          code_banque: string
          code_guichet: string
          compte_commission: string
          compte_produit: string
          created_at: string
          frais_virement: number
          id: string
          is_active: boolean | null
          nom_clm: string
        }
        Insert: {
          code_banque: string
          code_guichet: string
          compte_commission: string
          compte_produit: string
          created_at?: string
          frais_virement?: number
          id?: string
          is_active?: boolean | null
          nom_clm: string
        }
        Update: {
          code_banque?: string
          code_guichet?: string
          compte_commission?: string
          compte_produit?: string
          created_at?: string
          frais_virement?: number
          id?: string
          is_active?: boolean | null
          nom_clm?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          adresse: string | null
          code_client: string
          compte_prelevement: string | null
          contact_email: string | null
          contact_telephone: string | null
          created_at: string | null
          fee_option: Database["public"]["Enums"]["fee_option"]
          id: string
          is_active: boolean | null
          montant_frais: number | null
          nom_entreprise: string
          notes: string | null
          updated_at: string | null
          ville: Database["public"]["Enums"]["ville_region"]
        }
        Insert: {
          adresse?: string | null
          code_client: string
          compte_prelevement?: string | null
          contact_email?: string | null
          contact_telephone?: string | null
          created_at?: string | null
          fee_option?: Database["public"]["Enums"]["fee_option"]
          id?: string
          is_active?: boolean | null
          montant_frais?: number | null
          nom_entreprise: string
          notes?: string | null
          updated_at?: string | null
          ville?: Database["public"]["Enums"]["ville_region"]
        }
        Update: {
          adresse?: string | null
          code_client?: string
          compte_prelevement?: string | null
          contact_email?: string | null
          contact_telephone?: string | null
          created_at?: string | null
          fee_option?: Database["public"]["Enums"]["fee_option"]
          id?: string
          is_active?: boolean | null
          montant_frais?: number | null
          nom_entreprise?: string
          notes?: string | null
          updated_at?: string | null
          ville?: Database["public"]["Enums"]["ville_region"]
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
      file_staging: {
        Row: {
          created_at: string
          entries_count: number
          error_message: string | null
          file_content: string
          file_format: string
          file_hash: string
          file_name: string
          file_type: string
          id: string
          import_id: string | null
          staging_path: string | null
          status: string | null
          target_empty_verified: boolean | null
          target_path: string | null
          total_amount: number
          total_fees: number
          transferred_at: string | null
          validation_passed: boolean | null
        }
        Insert: {
          created_at?: string
          entries_count?: number
          error_message?: string | null
          file_content: string
          file_format: string
          file_hash: string
          file_name: string
          file_type: string
          id?: string
          import_id?: string | null
          staging_path?: string | null
          status?: string | null
          target_empty_verified?: boolean | null
          target_path?: string | null
          total_amount?: number
          total_fees?: number
          transferred_at?: string | null
          validation_passed?: boolean | null
        }
        Update: {
          created_at?: string
          entries_count?: number
          error_message?: string | null
          file_content?: string
          file_format?: string
          file_hash?: string
          file_name?: string
          file_type?: string
          id?: string
          import_id?: string | null
          staging_path?: string | null
          status?: string | null
          target_empty_verified?: boolean | null
          target_path?: string | null
          total_amount?: number
          total_fees?: number
          transferred_at?: string | null
          validation_passed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "file_staging_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_entries: {
        Row: {
          account_id: string
          amount: number
          amount_cents: number
          branch_code: string
          clm_agency_id: string | null
          created_at: string
          entry_type: string
          fee_amount: number | null
          generated_file_id: string | null
          id: string
          id_societaire: string | null
          import_id: string | null
          is_clm_account: boolean | null
          is_split_entry: boolean | null
          matricule: string
          nom_beneficiaire: string | null
          original_amount: number | null
          payroll_entry_id: string | null
          reconciliation_account: string | null
          sequence_number: number
          side: string
          split_percentage: number | null
          split_transaction_id: string | null
        }
        Insert: {
          account_id: string
          amount: number
          amount_cents: number
          branch_code: string
          clm_agency_id?: string | null
          created_at?: string
          entry_type: string
          fee_amount?: number | null
          generated_file_id?: string | null
          id?: string
          id_societaire?: string | null
          import_id?: string | null
          is_clm_account?: boolean | null
          is_split_entry?: boolean | null
          matricule: string
          nom_beneficiaire?: string | null
          original_amount?: number | null
          payroll_entry_id?: string | null
          reconciliation_account?: string | null
          sequence_number: number
          side: string
          split_percentage?: number | null
          split_transaction_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          amount_cents?: number
          branch_code?: string
          clm_agency_id?: string | null
          created_at?: string
          entry_type?: string
          fee_amount?: number | null
          generated_file_id?: string | null
          id?: string
          id_societaire?: string | null
          import_id?: string | null
          is_clm_account?: boolean | null
          is_split_entry?: boolean | null
          matricule?: string
          nom_beneficiaire?: string | null
          original_amount?: number | null
          payroll_entry_id?: string | null
          reconciliation_account?: string | null
          sequence_number?: number
          side?: string
          split_percentage?: number | null
          split_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_entries_clm_agency_id_fkey"
            columns: ["clm_agency_id"]
            isOneToOne: false
            referencedRelation: "clm_agency_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_entries_generated_file_id_fkey"
            columns: ["generated_file_id"]
            isOneToOne: false
            referencedRelation: "generated_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_entries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_entries_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_entries_split_transaction_id_fkey"
            columns: ["split_transaction_id"]
            isOneToOne: false
            referencedRelation: "split_transactions"
            referencedColumns: ["id"]
          },
        ]
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
      import_entries: {
        Row: {
          cco: string
          cco_original: string | null
          code_caisse: string
          correction_details: string | null
          created_at: string | null
          id: string
          is_doublon: boolean | null
          matricule: string
          matricule_original: string | null
          montant: number
          nom: string
          periode: string
          prenom: string | null
          session_id: string
          status: string | null
          validation_error: string | null
          was_corrected: boolean | null
        }
        Insert: {
          cco: string
          cco_original?: string | null
          code_caisse: string
          correction_details?: string | null
          created_at?: string | null
          id?: string
          is_doublon?: boolean | null
          matricule: string
          matricule_original?: string | null
          montant?: number
          nom: string
          periode: string
          prenom?: string | null
          session_id: string
          status?: string | null
          validation_error?: string | null
          was_corrected?: boolean | null
        }
        Update: {
          cco?: string
          cco_original?: string | null
          code_caisse?: string
          correction_details?: string | null
          created_at?: string | null
          id?: string
          is_doublon?: boolean | null
          matricule?: string
          matricule_original?: string | null
          montant?: number
          nom?: string
          periode?: string
          prenom?: string | null
          session_id?: string
          status?: string | null
          validation_error?: string | null
          was_corrected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "import_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sessions: {
        Row: {
          annee: number
          corrections_applied: number | null
          created_at: string | null
          created_by: string | null
          entreprise: string | null
          file_name: string
          id: string
          lignes_doublons: number | null
          lignes_rejetees: number | null
          lignes_valides: number | null
          mois: number
          montant_total: number | null
          status: string | null
          total_lignes: number | null
          ville: Database["public"]["Enums"]["ville_region"]
        }
        Insert: {
          annee: number
          corrections_applied?: number | null
          created_at?: string | null
          created_by?: string | null
          entreprise?: string | null
          file_name: string
          id?: string
          lignes_doublons?: number | null
          lignes_rejetees?: number | null
          lignes_valides?: number | null
          mois: number
          montant_total?: number | null
          status?: string | null
          total_lignes?: number | null
          ville?: Database["public"]["Enums"]["ville_region"]
        }
        Update: {
          annee?: number
          corrections_applied?: number | null
          created_at?: string | null
          created_by?: string | null
          entreprise?: string | null
          file_name?: string
          id?: string
          lignes_doublons?: number | null
          lignes_rejetees?: number | null
          lignes_valides?: number | null
          mois?: number
          montant_total?: number | null
          status?: string | null
          total_lignes?: number | null
          ville?: Database["public"]["Enums"]["ville_region"]
        }
        Relationships: []
      }
      integrity_alerts: {
        Row: {
          alert_severity: Database["public"]["Enums"]["alert_severity"] | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          company_id: string | null
          created_at: string | null
          description: string
          id: string
          import_id: string | null
          is_resolved: boolean | null
          related_entity_id: string | null
          related_entity_type: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          suggested_action: string | null
          title: string
        }
        Insert: {
          alert_severity?: Database["public"]["Enums"]["alert_severity"] | null
          alert_type: Database["public"]["Enums"]["alert_type"]
          company_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          import_id?: string | null
          is_resolved?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          suggested_action?: string | null
          title: string
        }
        Update: {
          alert_severity?: Database["public"]["Enums"]["alert_severity"] | null
          alert_type?: Database["public"]["Enums"]["alert_type"]
          company_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          import_id?: string | null
          is_resolved?: boolean | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          suggested_action?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
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
      monthly_flux_counter: {
        Row: {
          alert_generated: boolean | null
          alert_message: string | null
          company_id: string
          created_at: string | null
          flux_number: number
          flux_status: Database["public"]["Enums"]["flux_status"]
          frais_appliques: number | null
          frais_attendus: number | null
          id: string
          import_id: string | null
          processed_at: string | null
          year_month: string
        }
        Insert: {
          alert_generated?: boolean | null
          alert_message?: string | null
          company_id: string
          created_at?: string | null
          flux_number: number
          flux_status?: Database["public"]["Enums"]["flux_status"]
          frais_appliques?: number | null
          frais_attendus?: number | null
          id?: string
          import_id?: string | null
          processed_at?: string | null
          year_month: string
        }
        Update: {
          alert_generated?: boolean | null
          alert_message?: string | null
          company_id?: string
          created_at?: string | null
          flux_number?: number
          flux_status?: Database["public"]["Enums"]["flux_status"]
          frais_appliques?: number | null
          frais_attendus?: number | null
          id?: string
          import_id?: string | null
          processed_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_flux_counter_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      normalized_matricules: {
        Row: {
          created_at: string | null
          id: string
          id_societaire: string | null
          last_seen_at: string | null
          match_confidence: number | null
          match_method: string | null
          matricule_normalized: string
          matricule_original: string
          matricule_padded: string | null
          nom_employe: string | null
          rib_associe: string | null
          source_import_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          id_societaire?: string | null
          last_seen_at?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matricule_normalized: string
          matricule_original: string
          matricule_padded?: string | null
          nom_employe?: string | null
          rib_associe?: string | null
          source_import_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          id_societaire?: string | null
          last_seen_at?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matricule_normalized?: string
          matricule_original?: string
          matricule_padded?: string | null
          nom_employe?: string | null
          rib_associe?: string | null
          source_import_id?: string | null
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
          created_by: string | null
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
          ville: Database["public"]["Enums"]["ville_region"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
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
          ville?: Database["public"]["Enums"]["ville_region"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
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
          ville?: Database["public"]["Enums"]["ville_region"]
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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
          user_id: string
          ville: Database["public"]["Enums"]["ville_region"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          updated_at?: string
          user_id: string
          ville?: Database["public"]["Enums"]["ville_region"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
          ville?: Database["public"]["Enums"]["ville_region"]
        }
        Relationships: []
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
      reference_corrections: {
        Row: {
          cco_correct: string | null
          cco_errone: string | null
          commentaire: string | null
          created_at: string | null
          id: string
          matricule_correct: string
          matricule_errone: string
          updated_at: string | null
        }
        Insert: {
          cco_correct?: string | null
          cco_errone?: string | null
          commentaire?: string | null
          created_at?: string | null
          id?: string
          matricule_correct: string
          matricule_errone: string
          updated_at?: string | null
        }
        Update: {
          cco_correct?: string | null
          cco_errone?: string | null
          commentaire?: string | null
          created_at?: string | null
          id?: string
          matricule_correct?: string
          matricule_errone?: string
          updated_at?: string | null
        }
        Relationships: []
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
          beneficiaire_nom: string | null
          beneficiaire_rib: string | null
          created_at: string
          created_by: string | null
          date_debut: string | null
          date_fin: string | null
          employeur_code: string | null
          id: string
          id_societaire: string | null
          identity_verified: boolean | null
          is_active: boolean | null
          matricule: string | null
          montant_minimum_split: number | null
          montant_saisie: number | null
          motif_saisie: string | null
          percentage_courant: number
          percentage_epargne: number
          plafond_total: number | null
          priority: number | null
          reference_juridique: string | null
          rib_courant_cible: string | null
          rib_epargne_cible: string | null
          rule_name: string
          rule_type: string
          total_deja_preleve: number | null
          updated_at: string
        }
        Insert: {
          beneficiaire_nom?: string | null
          beneficiaire_rib?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          employeur_code?: string | null
          id?: string
          id_societaire?: string | null
          identity_verified?: boolean | null
          is_active?: boolean | null
          matricule?: string | null
          montant_minimum_split?: number | null
          montant_saisie?: number | null
          motif_saisie?: string | null
          percentage_courant?: number
          percentage_epargne?: number
          plafond_total?: number | null
          priority?: number | null
          reference_juridique?: string | null
          rib_courant_cible?: string | null
          rib_epargne_cible?: string | null
          rule_name: string
          rule_type?: string
          total_deja_preleve?: number | null
          updated_at?: string
        }
        Update: {
          beneficiaire_nom?: string | null
          beneficiaire_rib?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          employeur_code?: string | null
          id?: string
          id_societaire?: string | null
          identity_verified?: boolean | null
          is_active?: boolean | null
          matricule?: string | null
          montant_minimum_split?: number | null
          montant_saisie?: number | null
          motif_saisie?: string | null
          percentage_courant?: number
          percentage_epargne?: number
          plafond_total?: number | null
          priority?: number | null
          reference_juridique?: string | null
          rib_courant_cible?: string | null
          rib_epargne_cible?: string | null
          rule_name?: string
          rule_type?: string
          total_deja_preleve?: number | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          ville: Database["public"]["Enums"]["ville_region"] | null
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          ville?: Database["public"]["Enums"]["ville_region"] | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          ville?: Database["public"]["Enums"]["ville_region"] | null
        }
        Relationships: []
      }
      validation_workflow: {
        Row: {
          created_at: string
          id: string
          import_id: string | null
          rejection_reason: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["validation_status"]
          submitted_by: string | null
          transferred_at: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_method: string | null
          ville: Database["public"]["Enums"]["ville_region"]
        }
        Insert: {
          created_at?: string
          id?: string
          import_id?: string | null
          rejection_reason?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          submitted_by?: string | null
          transferred_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_method?: string | null
          ville: Database["public"]["Enums"]["ville_region"]
        }
        Update: {
          created_at?: string
          id?: string
          import_id?: string | null
          rejection_reason?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["validation_status"]
          submitted_by?: string | null
          transferred_at?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_method?: string | null
          ville?: Database["public"]["Enums"]["ville_region"]
        }
        Relationships: [
          {
            foreignKeyName: "validation_workflow_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "payroll_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_workflow_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      batch_generate_entries: {
        Args: { p_generated_file_id: string; p_import_id: string }
        Returns: {
          entries_clm: number
          entries_with_split: number
          total_amount: number
          total_entries: number
          total_fees: number
        }[]
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
      can_access_ville: {
        Args: {
          _user_id: string
          _ville: Database["public"]["Enums"]["ville_region"]
        }
        Returns: boolean
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
      generate_split_entries: {
        Args: {
          p_base_sequence: number
          p_generated_file_id: string
          p_import_id: string
          p_payroll_entry_id: string
        }
        Returns: {
          entries_generated: number
          next_sequence: number
          total_amount: number
          total_fees: number
        }[]
      }
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
      get_user_ville: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["ville_region"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      identify_clm_account: {
        Args: { p_rib: string }
        Returns: {
          clm_id: string
          clm_name: string
          compte_commission: string
          frais_virement: number
          is_clm: boolean
        }[]
      }
      is_admin_of_ville: {
        Args: {
          _user_id: string
          _ville: Database["public"]["Enums"]["ville_region"]
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
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
      alert_severity: "INFO" | "WARNING" | "CRITICAL"
      alert_type:
        | "FLUX_MANQUANT"
        | "FRAIS_NON_PRELEVES"
        | "MATRICULE_INCONNU"
        | "RIB_SUSPECT"
        | "SPLIT_IDENTITE"
        | "CLM_NON_TROUVE"
      app_role: "super_admin" | "admin" | "user"
      entry_type: "PRINCIPAL" | "EPARGNE" | "FRAIS_CLM" | "COMMISSION"
      fee_option: "OUI" | "NON" | "DEUXIEME_FLUX"
      flux_status: "PENDING" | "COMPLETED" | "SKIPPED"
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
      staging_status:
        | "GENERATING"
        | "VALIDATING"
        | "READY"
        | "TRANSFERRED"
        | "FAILED"
        | "ARCHIVED"
      validation_status:
        | "pending"
        | "in_review"
        | "validated"
        | "rejected"
        | "transferred"
      ville_region: "BRAZZAVILLE" | "POINTE_NOIRE"
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
      alert_severity: ["INFO", "WARNING", "CRITICAL"],
      alert_type: [
        "FLUX_MANQUANT",
        "FRAIS_NON_PRELEVES",
        "MATRICULE_INCONNU",
        "RIB_SUSPECT",
        "SPLIT_IDENTITE",
        "CLM_NON_TROUVE",
      ],
      app_role: ["super_admin", "admin", "user"],
      entry_type: ["PRINCIPAL", "EPARGNE", "FRAIS_CLM", "COMMISSION"],
      fee_option: ["OUI", "NON", "DEUXIEME_FLUX"],
      flux_status: ["PENDING", "COMPLETED", "SKIPPED"],
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
      staging_status: [
        "GENERATING",
        "VALIDATING",
        "READY",
        "TRANSFERRED",
        "FAILED",
        "ARCHIVED",
      ],
      validation_status: [
        "pending",
        "in_review",
        "validated",
        "rejected",
        "transferred",
      ],
      ville_region: ["BRAZZAVILLE", "POINTE_NOIRE"],
    },
  },
} as const
