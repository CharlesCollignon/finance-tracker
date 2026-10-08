/**
 * Generated from the local database by `pnpm gen:types`. Do not edit: change
 * a migration, apply it locally, and run the script again. The columns a
 * CHECK constraint narrows are narrowed in `./database.ts`, which is what the
 * apps import.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_connect_flows: {
        Row: {
          created_at: string;
          expires_at: string;
          key_id: string;
          mode: string;
          state: string;
          user_id: string;
          verifier_ciphertext: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          key_id: string;
          mode: string;
          state: string;
          user_id: string;
          verifier_ciphertext: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          key_id?: string;
          mode?: string;
          state?: string;
          user_id?: string;
          verifier_ciphertext?: string;
        };
        Relationships: [];
      };
      ai_connection_secrets: {
        Row: {
          ciphertext: string;
          created_at: string;
          key_id: string;
          user_id: string;
        };
        Insert: {
          ciphertext: string;
          created_at?: string;
          key_id: string;
          user_id: string;
        };
        Update: {
          ciphertext?: string;
          created_at?: string;
          key_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_connection_secrets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "ai_connections";
            referencedColumns: ["user_id"];
          },
        ];
      };
      ai_connections: {
        Row: {
          connected_at: string;
          last_error: string | null;
          last_used_at: string | null;
          model: string;
          provider: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connected_at?: string;
          last_error?: string | null;
          last_used_at?: string | null;
          model: string;
          provider?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connected_at?: string;
          last_error?: string | null;
          last_used_at?: string | null;
          model?: string;
          provider?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      balance_readings: {
        Row: {
          amount: number;
          created_at: string;
          read_on: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          read_on: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          read_on?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          account_type: string | null;
          bank_name: string | null;
          consent_valid_until: string | null;
          counts_as_cash: boolean;
          currency: string;
          first_seen_at: string;
          history_imported_at: string | null;
          label: string;
          last_seen_at: string;
          needs_reconnect: boolean;
          product: string | null;
          provider_account_id: string;
          reported_balance: number | null;
          reported_on: string | null;
          role: string | null;
          user_id: string;
        };
        Insert: {
          account_type?: string | null;
          bank_name?: string | null;
          consent_valid_until?: string | null;
          counts_as_cash?: boolean;
          currency: string;
          first_seen_at?: string;
          history_imported_at?: string | null;
          label: string;
          last_seen_at?: string;
          needs_reconnect?: boolean;
          product?: string | null;
          provider_account_id: string;
          reported_balance?: number | null;
          reported_on?: string | null;
          role?: string | null;
          user_id: string;
        };
        Update: {
          account_type?: string | null;
          bank_name?: string | null;
          consent_valid_until?: string | null;
          counts_as_cash?: boolean;
          currency?: string;
          first_seen_at?: string;
          history_imported_at?: string | null;
          label?: string;
          last_seen_at?: string;
          needs_reconnect?: boolean;
          product?: string | null;
          provider_account_id?: string;
          reported_balance?: number | null;
          reported_on?: string | null;
          role?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      bank_connection_secrets: {
        Row: {
          ciphertext: string;
          created_at: string;
          key_id: string;
          user_id: string;
        };
        Insert: {
          ciphertext: string;
          created_at?: string;
          key_id: string;
          user_id: string;
        };
        Update: {
          ciphertext?: string;
          created_at?: string;
          key_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bank_connections: {
        Row: {
          backfilled_at: string | null;
          connected_at: string;
          consent_given_at: string | null;
          consent_valid_until: string | null;
          consent_version: string | null;
          key_expires_at: string | null;
          last_error: string | null;
          last_synced_at: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          backfilled_at?: string | null;
          connected_at?: string;
          consent_given_at?: string | null;
          consent_valid_until?: string | null;
          consent_version?: string | null;
          key_expires_at?: string | null;
          last_error?: string | null;
          last_synced_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          backfilled_at?: string | null;
          connected_at?: string;
          consent_given_at?: string | null;
          consent_valid_until?: string | null;
          consent_version?: string | null;
          key_expires_at?: string | null;
          last_error?: string | null;
          last_synced_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      bank_feed_items: {
        Row: {
          amount: number;
          balance_after: number | null;
          counterparty: string | null;
          created_at: string;
          currency: string;
          decided_by: string | null;
          direction: string;
          id: string;
          intraday_index: number;
          merchant_category_code: string | null;
          note: string;
          occurred_on: string;
          provider_account_id: string;
          provider_id: string;
          status: string;
          transaction_id: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          balance_after?: number | null;
          counterparty?: string | null;
          created_at?: string;
          currency: string;
          decided_by?: string | null;
          direction: string;
          id?: string;
          intraday_index?: number;
          merchant_category_code?: string | null;
          note: string;
          occurred_on: string;
          provider_account_id: string;
          provider_id: string;
          status?: string;
          transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          balance_after?: number | null;
          counterparty?: string | null;
          created_at?: string;
          currency?: string;
          decided_by?: string | null;
          direction?: string;
          id?: string;
          intraday_index?: number;
          merchant_category_code?: string | null;
          note?: string;
          occurred_on?: string;
          provider_account_id?: string;
          provider_id?: string;
          status?: string;
          transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bank_feed_items_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      bank_pulls: {
        Row: {
          attended: number;
          last_pulled_at: string;
          pulled_on: string;
          unattended: number;
          user_id: string;
        };
        Insert: {
          attended?: number;
          last_pulled_at?: string;
          pulled_on: string;
          unattended?: number;
          user_id: string;
        };
        Update: {
          attended?: number;
          last_pulled_at?: string;
          pulled_on?: string;
          unattended?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      bearing_arrangements: {
        Row: {
          arranged_at: string | null;
          arrangement: Json | null;
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        Insert: {
          arranged_at?: string | null;
          arrangement?: Json | null;
          dropped?: number;
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          refused?: number;
          tally_month: string;
          user_id: string;
          writes?: number;
        };
        Update: {
          arranged_at?: string | null;
          arrangement?: Json | null;
          dropped?: number;
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          refused?: number;
          tally_month?: string;
          user_id?: string;
          writes?: number;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          amount: number;
          category_id: string | null;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          archived: boolean;
          counts_toward_summary: boolean;
          created_at: string;
          deleted_at: string | null;
          icon: string | null;
          id: string;
          name: string;
          type: Database["public"]["Enums"]["category_type"];
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          counts_toward_summary?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          type: Database["public"]["Enums"]["category_type"];
          user_id: string;
        };
        Update: {
          archived?: boolean;
          counts_toward_summary?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["category_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      category_read_tallies: {
        Row: {
          month: string;
          user_id: string;
          writes: number;
        };
        Insert: {
          month: string;
          user_id: string;
          writes?: number;
        };
        Update: {
          month?: string;
          user_id?: string;
          writes?: number;
        };
        Relationships: [];
      };
      category_reads: {
        Row: {
          category_id: string;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        Insert: {
          category_id: string;
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          read?: Json | null;
          refused?: number;
          trimmed?: number;
          user_id: string;
          writes?: number;
          written_at?: string | null;
        };
        Update: {
          category_id?: string;
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          read?: Json | null;
          refused?: number;
          trimmed?: number;
          user_id?: string;
          writes?: number;
          written_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "category_reads_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      category_selections: {
        Row: {
          findings_digest: string | null;
          last_written_at: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          selection: Json | null;
          tally_month: string | null;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        Insert: {
          findings_digest?: string | null;
          last_written_at?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          refused?: number;
          selection?: Json | null;
          tally_month?: string | null;
          user_id: string;
          writes?: number;
          written_at?: string | null;
        };
        Update: {
          findings_digest?: string | null;
          last_written_at?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          refused?: number;
          selection?: Json | null;
          tally_month?: string | null;
          user_id?: string;
          writes?: number;
          written_at?: string | null;
        };
        Relationships: [];
      };
      deletion_undo: {
        Row: {
          category_ids: string[];
          created_at: string;
          feed_items: NonNullable<Json>;
          fulfilments: NonNullable<Json>;
          token: string;
          transaction_ids: string[];
          user_id: string;
        };
        Insert: {
          category_ids?: string[];
          created_at?: string;
          feed_items?: NonNullable<Json>;
          fulfilments?: NonNullable<Json>;
          token?: string;
          transaction_ids?: string[];
          user_id: string;
        };
        Update: {
          category_ids?: string[];
          created_at?: string;
          feed_items?: NonNullable<Json>;
          fulfilments?: NonNullable<Json>;
          token?: string;
          transaction_ids?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      expo_push_tokens: {
        Row: {
          created_at: string;
          device_name: string | null;
          id: string;
          last_seen_at: string;
          platform: string | null;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_name?: string | null;
          id?: string;
          last_seen_at?: string;
          platform?: string | null;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_name?: string | null;
          id?: string;
          last_seen_at?: string;
          platform?: string | null;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      feature_flags: {
        Row: {
          created_at: string;
          description: string;
          enabled_by_default: boolean;
          enabled_from: string | null;
          key: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          enabled_by_default?: boolean;
          enabled_from?: string | null;
          key: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          enabled_by_default?: boolean;
          enabled_from?: string | null;
          key?: string;
        };
        Relationships: [];
      };
      housing_price_index: {
        Row: {
          quarter: string;
          series: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          quarter: string;
          series: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          quarter?: string;
          series?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [];
      };
      instrument_reading_tallies: {
        Row: {
          last_read_at: string | null;
          pending_since: string | null;
          reads: number;
          tally_month: string;
          user_id: string;
        };
        Insert: {
          last_read_at?: string | null;
          pending_since?: string | null;
          reads?: number;
          tally_month: string;
          user_id: string;
        };
        Update: {
          last_read_at?: string | null;
          pending_since?: string | null;
          reads?: number;
          tally_month?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      instrument_readings: {
        Row: {
          asset_kind: string | null;
          constituents_coverage: number | null;
          country_weights: NonNullable<Json>;
          currency: string | null;
          isin: string;
          model: string | null;
          ongoing_charge: number | null;
          sector_weights: NonNullable<Json>;
          sourced_at: string;
          sources: NonNullable<Json>;
          top_constituents: NonNullable<Json>;
          user_id: string;
          version: number;
        };
        Insert: {
          asset_kind?: string | null;
          constituents_coverage?: number | null;
          country_weights?: NonNullable<Json>;
          currency?: string | null;
          isin: string;
          model?: string | null;
          ongoing_charge?: number | null;
          sector_weights?: NonNullable<Json>;
          sourced_at?: string;
          sources?: NonNullable<Json>;
          top_constituents?: NonNullable<Json>;
          user_id: string;
          version?: number;
        };
        Update: {
          asset_kind?: string | null;
          constituents_coverage?: number | null;
          country_weights?: NonNullable<Json>;
          currency?: string | null;
          isin?: string;
          model?: string | null;
          ongoing_charge?: number | null;
          sector_weights?: NonNullable<Json>;
          sourced_at?: string;
          sources?: NonNullable<Json>;
          top_constituents?: NonNullable<Json>;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      investment_positions: {
        Row: {
          category_id: string | null;
          current_value: number | null;
          id: string;
          initial_balance: number;
          instrument_name: string | null;
          instrument_symbol: string | null;
          isin: string | null;
          name: string;
          ongoing_charge: number | null;
          recurring_template_id: string | null;
          share_count: number | null;
          updated_at: string;
          user_id: string;
          value_pinned: boolean;
          wallet: Database["public"]["Enums"]["investment_wallet"];
        };
        Insert: {
          category_id?: string | null;
          current_value?: number | null;
          id?: string;
          initial_balance?: number;
          instrument_name?: string | null;
          instrument_symbol?: string | null;
          isin?: string | null;
          name: string;
          ongoing_charge?: number | null;
          recurring_template_id?: string | null;
          share_count?: number | null;
          updated_at?: string;
          user_id: string;
          value_pinned?: boolean;
          wallet: Database["public"]["Enums"]["investment_wallet"];
        };
        Update: {
          category_id?: string | null;
          current_value?: number | null;
          id?: string;
          initial_balance?: number;
          instrument_name?: string | null;
          instrument_symbol?: string | null;
          isin?: string | null;
          name?: string;
          ongoing_charge?: number | null;
          recurring_template_id?: string | null;
          share_count?: number | null;
          updated_at?: string;
          user_id?: string;
          value_pinned?: boolean;
          wallet?: Database["public"]["Enums"]["investment_wallet"];
        };
        Relationships: [
          {
            foreignKeyName: "investment_positions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_positions_recurring_template_id_fkey";
            columns: ["recurring_template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      month_close_settings: {
        Row: {
          close_day: number;
          unrecorded_cap: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          close_day?: number;
          unrecorded_cap?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          close_day?: number;
          unrecorded_cap?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      month_closes: {
        Row: {
          balance_source: string;
          bank_accounts: string[] | null;
          closing_balance: number;
          created_at: string;
          id: string;
          month: string;
          observed_on: string;
          opening_balance: number | null;
          user_id: string;
        };
        Insert: {
          balance_source?: string;
          bank_accounts?: string[] | null;
          closing_balance: number;
          created_at?: string;
          id?: string;
          month: string;
          observed_on: string;
          opening_balance?: number | null;
          user_id: string;
        };
        Update: {
          balance_source?: string;
          bank_accounts?: string[] | null;
          closing_balance?: number;
          created_at?: string;
          id?: string;
          month?: string;
          observed_on?: string;
          opening_balance?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      month_reads: {
        Row: {
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          month: string;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          source: string;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        Insert: {
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          month: string;
          pending_since?: string | null;
          prompt_version?: number | null;
          read?: Json | null;
          refused?: number;
          source?: string;
          trimmed?: number;
          user_id: string;
          writes?: number;
          written_at?: string | null;
        };
        Update: {
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          month?: string;
          pending_since?: string | null;
          prompt_version?: number | null;
          read?: Json | null;
          refused?: number;
          source?: string;
          trimmed?: number;
          user_id?: string;
          writes?: number;
          written_at?: string | null;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          key: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          key: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          key?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address_label: string | null;
          agency_fees: number;
          citycode: string | null;
          created_at: string;
          energy_class: string | null;
          id: string;
          kind: string;
          latitude: number | null;
          living_area: number | null;
          longitude: number | null;
          name: string;
          notary_fees: number;
          ownership_share: number;
          postcode: string | null;
          purchase_price: number;
          purchased_on: string;
          rooms: number | null;
          updated_at: string;
          usage: string;
          user_id: string;
          value_pinned: number | null;
          value_pinned_on: string | null;
          works: number;
          yearly_growth: number | null;
        };
        Insert: {
          address_label?: string | null;
          agency_fees?: number;
          citycode?: string | null;
          created_at?: string;
          energy_class?: string | null;
          id?: string;
          kind: string;
          latitude?: number | null;
          living_area?: number | null;
          longitude?: number | null;
          name: string;
          notary_fees?: number;
          ownership_share?: number;
          postcode?: string | null;
          purchase_price: number;
          purchased_on: string;
          rooms?: number | null;
          updated_at?: string;
          usage?: string;
          user_id: string;
          value_pinned?: number | null;
          value_pinned_on?: string | null;
          works?: number;
          yearly_growth?: number | null;
        };
        Update: {
          address_label?: string | null;
          agency_fees?: number;
          citycode?: string | null;
          created_at?: string;
          energy_class?: string | null;
          id?: string;
          kind?: string;
          latitude?: number | null;
          living_area?: number | null;
          longitude?: number | null;
          name?: string;
          notary_fees?: number;
          ownership_share?: number;
          postcode?: string | null;
          purchase_price?: number;
          purchased_on?: string;
          rooms?: number | null;
          updated_at?: string;
          usage?: string;
          user_id?: string;
          value_pinned?: number | null;
          value_pinned_on?: string | null;
          works?: number;
          yearly_growth?: number | null;
        };
        Relationships: [];
      };
      property_loans: {
        Row: {
          annual_rate: number;
          borrower_share: number;
          created_at: string;
          deferral_kind: string;
          deferral_months: number;
          fees: number;
          first_payment_on: string;
          id: string;
          insurance_monthly: number;
          insurance_rate: number | null;
          insurance_separate: boolean;
          insurance_template_id: string | null;
          kind: string;
          known_keeps: string | null;
          known_outstanding: number | null;
          known_outstanding_on: string | null;
          label: string;
          months: number;
          principal: number;
          property_id: string;
          recurring_template_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          annual_rate: number;
          borrower_share?: number;
          created_at?: string;
          deferral_kind?: string;
          deferral_months?: number;
          fees?: number;
          first_payment_on: string;
          id?: string;
          insurance_monthly?: number;
          insurance_rate?: number | null;
          insurance_separate?: boolean;
          insurance_template_id?: string | null;
          kind?: string;
          known_keeps?: string | null;
          known_outstanding?: number | null;
          known_outstanding_on?: string | null;
          label: string;
          months: number;
          principal: number;
          property_id: string;
          recurring_template_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          annual_rate?: number;
          borrower_share?: number;
          created_at?: string;
          deferral_kind?: string;
          deferral_months?: number;
          fees?: number;
          first_payment_on?: string;
          id?: string;
          insurance_monthly?: number;
          insurance_rate?: number | null;
          insurance_separate?: boolean;
          insurance_template_id?: string | null;
          kind?: string;
          known_keeps?: string | null;
          known_outstanding?: number | null;
          known_outstanding_on?: string | null;
          label?: string;
          months?: number;
          principal?: number;
          property_id?: string;
          recurring_template_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_loans_insurance_template_id_fkey";
            columns: ["insurance_template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_loans_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_loans_recurring_template_id_fkey";
            columns: ["recurring_template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      property_market_readings: {
        Row: {
          median_m2: number;
          period_from: string;
          period_to: string;
          property_id: string;
          q1_m2: number;
          q3_m2: number;
          quarter: string;
          read_at: string;
          sales: number;
          scope: string;
          user_id: string;
        };
        Insert: {
          median_m2: number;
          period_from: string;
          period_to: string;
          property_id: string;
          q1_m2: number;
          q3_m2: number;
          quarter: string;
          read_at?: string;
          sales: number;
          scope: string;
          user_id: string;
        };
        Update: {
          median_m2?: number;
          period_from?: string;
          period_to?: string;
          property_id?: string;
          q1_m2?: number;
          q3_m2?: number;
          quarter?: string;
          read_at?: string;
          sales?: number;
          scope?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_market_readings_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_rent_references: {
        Row: {
          edition: number;
          high_m2: number;
          low_m2: number;
          observations: number;
          property_id: string;
          read_at: string;
          rent_m2: number;
          scope: string;
          series: string;
          user_id: string;
        };
        Insert: {
          edition: number;
          high_m2: number;
          low_m2: number;
          observations: number;
          property_id: string;
          read_at?: string;
          rent_m2: number;
          scope: string;
          series: string;
          user_id: string;
        };
        Update: {
          edition?: number;
          high_m2?: number;
          low_m2?: number;
          observations?: number;
          property_id?: string;
          read_at?: string;
          rent_m2?: number;
          scope?: string;
          series?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_rent_references_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: true;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_seen_at: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_seen_at?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_seen_at?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_fulfilment_refusals: {
        Row: {
          occurred_on: string;
          refused_at: string;
          template_id: string;
          transaction_id: string;
          user_id: string;
        };
        Insert: {
          occurred_on: string;
          refused_at?: string;
          template_id: string;
          transaction_id: string;
          user_id: string;
        };
        Update: {
          occurred_on?: string;
          refused_at?: string;
          template_id?: string;
          transaction_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_fulfilment_refusals_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_fulfilment_refusals_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_fulfilments: {
        Row: {
          confirmed_at: string;
          occurred_on: string;
          template_id: string;
          transaction_id: string;
          user_id: string;
        };
        Insert: {
          confirmed_at?: string;
          occurred_on: string;
          template_id: string;
          transaction_id: string;
          user_id: string;
        };
        Update: {
          confirmed_at?: string;
          occurred_on?: string;
          template_id?: string;
          transaction_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_fulfilments_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_fulfilments_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_proposal_dismissals: {
        Row: {
          created_at: string;
          merchant_key: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          merchant_key: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          merchant_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_skips: {
        Row: {
          created_at: string;
          id: string;
          occurred_on: string;
          template_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          occurred_on: string;
          template_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          occurred_on?: string;
          template_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_skips_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_templates: {
        Row: {
          active: boolean;
          amount: number;
          category_id: string;
          created_at: string;
          day_of_month: number | null;
          day_of_week: number | null;
          description: string | null;
          ends_on: string | null;
          funded_by_transfer: boolean;
          id: string;
          instrument_name: string | null;
          instrument_symbol: string | null;
          last_quote_at: string | null;
          last_quote_price: number | null;
          month_of_year: number | null;
          pricing_type: Database["public"]["Enums"]["pricing_type"];
          property_id: string | null;
          recurrence: Database["public"]["Enums"]["recurrence_type"];
          share_count: number | null;
          starts_on: string | null;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          amount: number;
          category_id: string;
          created_at?: string;
          day_of_month?: number | null;
          day_of_week?: number | null;
          description?: string | null;
          ends_on?: string | null;
          funded_by_transfer?: boolean;
          id?: string;
          instrument_name?: string | null;
          instrument_symbol?: string | null;
          last_quote_at?: string | null;
          last_quote_price?: number | null;
          month_of_year?: number | null;
          pricing_type?: Database["public"]["Enums"]["pricing_type"];
          property_id?: string | null;
          recurrence?: Database["public"]["Enums"]["recurrence_type"];
          share_count?: number | null;
          starts_on?: string | null;
          user_id: string;
        };
        Update: {
          active?: boolean;
          amount?: number;
          category_id?: string;
          created_at?: string;
          day_of_month?: number | null;
          day_of_week?: number | null;
          description?: string | null;
          ends_on?: string | null;
          funded_by_transfer?: boolean;
          id?: string;
          instrument_name?: string | null;
          instrument_symbol?: string | null;
          last_quote_at?: string | null;
          last_quote_price?: number | null;
          month_of_year?: number | null;
          pricing_type?: Database["public"]["Enums"]["pricing_type"];
          property_id?: string | null;
          recurrence?: Database["public"]["Enums"]["recurrence_type"];
          share_count?: number | null;
          starts_on?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_templates_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_templates_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      savings_accounts: {
        Row: {
          annual_rate: number | null;
          balance: number;
          balance_on: string;
          bank_account_id: string | null;
          category_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          target_weight: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          annual_rate?: number | null;
          balance?: number;
          balance_on?: string;
          bank_account_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          target_weight?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          annual_rate?: number | null;
          balance?: number;
          balance_on?: string;
          bank_account_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          target_weight?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_accounts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      savings_goals: {
        Row: {
          category_id: string | null;
          created_at: string;
          id: string;
          name: string;
          starts_on: string;
          target_amount: number;
          target_date: string | null;
          user_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          starts_on?: string;
          target_amount: number;
          target_date?: string | null;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          starts_on?: string;
          target_amount?: number;
          target_date?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_goals_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      transaction_tags: {
        Row: {
          tag_id: string;
          transaction_id: string;
        };
        Insert: {
          tag_id: string;
          transaction_id: string;
        };
        Update: {
          tag_id?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          amount: number;
          cash_on: string | null;
          category_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          note: string | null;
          occurred_on: string;
          recurring_template_id: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          cash_on?: string | null;
          category_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          note?: string | null;
          occurred_on: string;
          recurring_template_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          cash_on?: string | null;
          category_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          note?: string | null;
          occurred_on?: string;
          recurring_template_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_recurring_template_id_fkey";
            columns: ["recurring_template_id"];
            isOneToOne: false;
            referencedRelation: "recurring_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      user_feature_flags: {
        Row: {
          created_at: string;
          enabled: boolean;
          flag_key: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enabled: boolean;
          flag_key: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          flag_key?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_feature_flags_flag_key_fkey";
            columns: ["flag_key"];
            isOneToOne: false;
            referencedRelation: "feature_flags";
            referencedColumns: ["key"];
          },
        ];
      };
      user_preferences: {
        Row: {
          bearing_pins: Json | null;
          dismissed_prompts: string[];
          locale: string;
          measure_audience: boolean;
          milestone_history: NonNullable<Json>;
          milestone_seen: number | null;
          notification_prefs: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bearing_pins?: Json | null;
          dismissed_prompts?: string[];
          locale?: string;
          measure_audience?: boolean;
          milestone_history?: NonNullable<Json>;
          milestone_seen?: number | null;
          notification_prefs?: NonNullable<Json>;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bearing_pins?: Json | null;
          dismissed_prompts?: string[];
          locale?: string;
          measure_audience?: boolean;
          milestone_history?: NonNullable<Json>;
          milestone_seen?: number | null;
          notification_prefs?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      wallet_plans: {
        Row: {
          contribution_ceiling: number | null;
          opened_on: string | null;
          shown: boolean;
          target_weight: number | null;
          updated_at: string;
          user_id: string;
          wallet: Database["public"]["Enums"]["investment_wallet"];
          wrapper_fee: number | null;
        };
        Insert: {
          contribution_ceiling?: number | null;
          opened_on?: string | null;
          shown?: boolean;
          target_weight?: number | null;
          updated_at?: string;
          user_id: string;
          wallet: Database["public"]["Enums"]["investment_wallet"];
          wrapper_fee?: number | null;
        };
        Update: {
          contribution_ceiling?: number | null;
          opened_on?: string | null;
          shown?: boolean;
          target_weight?: number | null;
          updated_at?: string;
          user_id?: string;
          wallet?: Database["public"]["Enums"]["investment_wallet"];
          wrapper_fee?: number | null;
        };
        Relationships: [];
      };
      wallet_reads: {
        Row: {
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          read_at: string | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        Insert: {
          dropped?: number;
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          read?: Json | null;
          read_at?: string | null;
          refused?: number;
          tally_month: string;
          user_id: string;
          writes?: number;
        };
        Update: {
          dropped?: number;
          facts?: Json | null;
          facts_digest?: string | null;
          last_written_at?: string | null;
          locale?: string | null;
          model?: string | null;
          pending_since?: string | null;
          prompt_version?: number | null;
          read?: Json | null;
          read_at?: string | null;
          refused?: number;
          tally_month?: string;
          user_id?: string;
          writes?: number;
        };
        Relationships: [];
      };
      wallet_transfers: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          note: string | null;
          occurred_on: string;
          to_wallet: Database["public"]["Enums"]["investment_wallet"];
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          occurred_on: string;
          to_wallet: Database["public"]["Enums"]["investment_wallet"];
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          occurred_on?: string;
          to_wallet?: Database["public"]["Enums"]["investment_wallet"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acting_for: { Args: { target_user: string }; Returns: boolean };
      bearing_pins_valid: { Args: { pins: Json }; Returns: boolean };
      evaluated_feature_flags: {
        Args: Record<PropertyKey, never>;
        Returns: {
          enabled: boolean;
          key: string;
        }[];
      };
      merge_tags: {
        Args: { from_tag: string; into_tag: string; target_user: string };
        Returns: number;
      };
      record_activity: { Args: { event?: string }; Returns: undefined };
      record_bank_pull: {
        Args: { target_user: string; today: string; was_attended: boolean };
        Returns: {
          attended: number;
          last_pulled_at: string;
          pulled_on: string;
          unattended: number;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "bank_pulls";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_bearing_arrangement: {
        Args: { target_user: string };
        Returns: {
          arranged_at: string | null;
          arrangement: Json | null;
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        SetofOptions: {
          from: "*";
          to: "bearing_arrangements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_category_read: {
        Args: { target_category: string; target_user: string };
        Returns: {
          category_id: string;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "category_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_category_selection: {
        Args: { target_user: string };
        Returns: {
          findings_digest: string | null;
          last_written_at: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          selection: Json | null;
          tally_month: string | null;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "category_selections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_instrument_reading: {
        Args: { target_user: string };
        Returns: {
          last_read_at: string | null;
          pending_since: string | null;
          reads: number;
          tally_month: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "instrument_reading_tallies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_month_read: {
        Args: { target_month: string; target_user: string };
        Returns: {
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          month: string;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          source: string;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "month_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_wallet_read: {
        Args: { target_user: string };
        Returns: {
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          read_at: string | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        SetofOptions: {
          from: "*";
          to: "wallet_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      release_instrument_reading: {
        Args: { target_user: string };
        Returns: {
          last_read_at: string | null;
          pending_since: string | null;
          reads: number;
          tally_month: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "instrument_reading_tallies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reserve_bearing_arrangement: {
        Args: {
          allowance: number;
          cooldown_seconds: number;
          reservation_seconds: number;
          target_user: string;
          this_month: string;
        };
        Returns: {
          arranged_at: string | null;
          arrangement: Json | null;
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        SetofOptions: {
          from: "*";
          to: "bearing_arrangements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reserve_category_read: {
        Args: {
          allowance: number;
          cooldown_seconds: number;
          reservation_seconds: number;
          target_category: string;
          target_user: string;
        };
        Returns: {
          category_id: string;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "category_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reserve_category_selection: {
        Args: {
          allowance: number;
          cooldown_seconds: number;
          reservation_seconds: number;
          target_user: string;
        };
        Returns: {
          findings_digest: string | null;
          last_written_at: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          selection: Json | null;
          tally_month: string | null;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "category_selections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reserve_instrument_reading: {
        Args: {
          allowance: number;
          cooldown_seconds: number;
          reservation_seconds: number;
          target_isin: string;
          target_user: string;
          this_month: string;
        };
        Returns: {
          last_read_at: string | null;
          pending_since: string | null;
          reads: number;
          tally_month: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "instrument_reading_tallies";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reserve_month_read: {
        Args: {
          allowance: number;
          cooldown_seconds: number;
          reservation_seconds: number;
          target_month: string;
          target_user: string;
        };
        Returns: {
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          month: string;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          source: string;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "month_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reserve_wallet_read: {
        Args: {
          allowance: number;
          cooldown_seconds: number;
          reservation_seconds: number;
          target_user: string;
          this_month: string;
        };
        Returns: {
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          read_at: string | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        SetofOptions: {
          from: "*";
          to: "wallet_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      restore_deletion: {
        Args: { target_user: string; undo_token: string };
        Returns: number;
      };
      restore_transactions: {
        Args: { ids: string[]; target_user: string };
        Returns: number;
      };
      soft_delete_category: {
        Args: { target_category: string; target_user: string };
        Returns: string;
      };
      soft_delete_transactions: {
        Args: { ids: string[]; target_user: string };
        Returns: string;
      };
      store_bearing_arrangement: {
        Args: {
          new_arrangement: Json;
          new_digest: string;
          new_dropped: number;
          new_facts: Json;
          new_locale: string;
          new_model: string;
          new_prompt_version: number;
          refused_delta: number;
          target_user: string;
        };
        Returns: {
          arranged_at: string | null;
          arrangement: Json | null;
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        SetofOptions: {
          from: "*";
          to: "bearing_arrangements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      store_category_read: {
        Args: {
          new_digest: string;
          new_facts: Json;
          new_locale: string;
          new_model: string;
          new_prompt_version: number;
          new_read: Json;
          new_trimmed: number;
          refused_delta: number;
          target_category: string;
          target_user: string;
        };
        Returns: {
          category_id: string;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "category_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      store_category_selection: {
        Args: {
          new_digest: string;
          new_model: string;
          new_prompt_version: number;
          new_selection: Json;
          refused_delta: number;
          target_user: string;
        };
        Returns: {
          findings_digest: string | null;
          last_written_at: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          refused: number;
          selection: Json | null;
          tally_month: string | null;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "category_selections";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      store_instrument_reading: {
        Args: {
          new_asset_kind?: string;
          new_charge: number;
          new_constituents: Json;
          new_country_weights: Json;
          new_coverage: number;
          new_currency: string;
          new_model: string;
          new_sector_weights: Json;
          new_sources: Json;
          new_version: number;
          target_isin: string;
          target_user: string;
        };
        Returns: {
          asset_kind: string | null;
          constituents_coverage: number | null;
          country_weights: NonNullable<Json>;
          currency: string | null;
          isin: string;
          model: string | null;
          ongoing_charge: number | null;
          sector_weights: NonNullable<Json>;
          sourced_at: string;
          sources: NonNullable<Json>;
          top_constituents: NonNullable<Json>;
          user_id: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "instrument_readings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      store_month_read: {
        Args: {
          new_digest: string;
          new_facts: Json;
          new_locale: string;
          new_model: string;
          new_prompt_version: number;
          new_read: Json;
          new_source: string;
          new_trimmed: number;
          refused_delta: number;
          target_month: string;
          target_user: string;
        };
        Returns: {
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          month: string;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          refused: number;
          source: string;
          trimmed: number;
          user_id: string;
          writes: number;
          written_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "month_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      store_wallet_read: {
        Args: {
          new_digest: string;
          new_dropped: number;
          new_facts: Json;
          new_locale: string;
          new_model: string;
          new_prompt_version: number;
          new_read: Json;
          refused_delta: number;
          target_user: string;
        };
        Returns: {
          dropped: number;
          facts: Json | null;
          facts_digest: string | null;
          last_written_at: string | null;
          locale: string | null;
          model: string | null;
          pending_since: string | null;
          prompt_version: number | null;
          read: Json | null;
          read_at: string | null;
          refused: number;
          tally_month: string;
          user_id: string;
          writes: number;
        };
        SetofOptions: {
          from: "*";
          to: "wallet_reads";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      sweep_activity: { Args: Record<PropertyKey, never>; Returns: number };
      sweep_deleted: { Args: { before: string }; Returns: number };
    };
    Enums: {
      category_type: "income" | "expense" | "savings" | "investment";
      investment_wallet: "pea" | "cto" | "crypto" | "av" | "per";
      pricing_type: "fixed" | "shares" | "purchases";
      recurrence_type: "monthly" | "weekly" | "yearly";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      category_type: ["income", "expense", "savings", "investment"],
      investment_wallet: ["pea", "cto", "crypto", "av", "per"],
      pricing_type: ["fixed", "shares", "purchases"],
      recurrence_type: ["monthly", "weekly", "yearly"],
    },
  },
} as const;
