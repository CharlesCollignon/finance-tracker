import type { BudgetViewMode } from "../constants";

export type CategoryType = "income" | "expense" | "savings" | "investment";

export type Recurrence = "monthly" | "weekly" | "yearly";

export type PricingType = "fixed" | "shares";

export type WalletId = "pea" | "cto" | "crypto";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: CategoryType;
          icon: string | null;
          counts_toward_summary: boolean;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: CategoryType;
          icon?: string | null;
          counts_toward_summary?: boolean;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: CategoryType;
          icon?: string | null;
          counts_toward_summary?: boolean;
          archived?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      recurring_templates: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          day_of_month: number | null;
          day_of_week: number | null;
          month_of_year: number | null;
          recurrence: Recurrence;
          active: boolean;
          description: string | null;
          pricing_type: PricingType;
          share_count: number | null;
          instrument_symbol: string | null;
          instrument_name: string | null;
          last_quote_price: number | null;
          last_quote_at: string | null;
          starts_on: string | null;
          ends_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          day_of_month?: number | null;
          day_of_week?: number | null;
          month_of_year?: number | null;
          recurrence?: Recurrence;
          active?: boolean;
          description?: string | null;
          pricing_type?: PricingType;
          share_count?: number | null;
          instrument_symbol?: string | null;
          instrument_name?: string | null;
          last_quote_price?: number | null;
          last_quote_at?: string | null;
          starts_on?: string | null;
          ends_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          day_of_month?: number | null;
          day_of_week?: number | null;
          month_of_year?: number | null;
          recurrence?: Recurrence;
          active?: boolean;
          description?: string | null;
          pricing_type?: PricingType;
          share_count?: number | null;
          instrument_symbol?: string | null;
          instrument_name?: string | null;
          last_quote_price?: number | null;
          last_quote_at?: string | null;
          starts_on?: string | null;
          ends_on?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_templates_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          recurring_template_id: string | null;
          occurred_on: string;
          amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          recurring_template_id?: string | null;
          occurred_on: string;
          /**
           * A decimal string is accepted so a bank's own figure can be written
           * through without a float ever touching it.
           */
          amount: number | string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          recurring_template_id?: string | null;
          occurred_on?: string;
          amount?: number;
          note?: string | null;
          created_at?: string;
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
      investment_positions: {
        Row: {
          id: string;
          user_id: string;
          wallet: WalletId;
          recurring_template_id: string | null;
          name: string;
          category_id: string | null;
          initial_balance: number;
          current_value: number | null;
          share_count: number | null;
          instrument_symbol: string | null;
          instrument_name: string | null;
          ongoing_charge: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet: WalletId;
          recurring_template_id?: string | null;
          name: string;
          category_id?: string | null;
          initial_balance?: number;
          current_value?: number | null;
          share_count?: number | null;
          instrument_symbol?: string | null;
          instrument_name?: string | null;
          ongoing_charge?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          wallet?: WalletId;
          recurring_template_id?: string | null;
          name?: string;
          category_id?: string | null;
          initial_balance?: number;
          current_value?: number | null;
          share_count?: number | null;
          instrument_symbol?: string | null;
          instrument_name?: string | null;
          ongoing_charge?: number | null;
          updated_at?: string;
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
      recurring_skips: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          occurred_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id: string;
          occurred_on: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string;
          occurred_on?: string;
          created_at?: string;
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
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          amount?: number;
          created_at?: string;
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
      wallet_transfers: {
        Row: {
          id: string;
          user_id: string;
          to_wallet: WalletId;
          amount: number;
          occurred_on: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          to_wallet: WalletId;
          amount: number;
          occurred_on: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          to_wallet?: WalletId;
          amount?: number;
          occurred_on?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      transaction_tags: {
        Row: {
          transaction_id: string;
          tag_id: string;
        };
        Insert: {
          transaction_id: string;
          tag_id: string;
        };
        Update: {
          transaction_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      savings_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          target_date: string | null;
          category_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_amount: number;
          target_date?: string | null;
          category_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          target_amount?: number;
          target_date?: string | null;
          category_id?: string | null;
          created_at?: string;
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
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          user_id: string;
          key: string;
          sent_at: string;
        };
        Insert: {
          user_id: string;
          key: string;
          sent_at?: string;
        };
        Update: {
          user_id?: string;
          key?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
      recurring_proposal_dismissals: {
        Row: {
          user_id: string;
          merchant_key: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          merchant_key: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          merchant_key?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bank_feed_items: {
        Row: {
          id: string;
          user_id: string;
          provider_id: string;
          provider_account_id: string;
          occurred_on: string;
          amount: number;
          currency: string;
          direction: "in" | "out";
          counterparty: string | null;
          note: string;
          merchant_category_code: string | null;
          /** The provider's running balance after this row, where it gave one. */
          balance_after: number | null;
          /** Position among the day's rows, newest first; 0 is the day's last. */
          intraday_index: number;
          status: "pending" | "imported" | "ignored";
          transaction_id: string | null;
          decided_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider_id: string;
          provider_account_id: string;
          occurred_on: string;
          /** Accepts the provider's decimal string, so no float is involved. */
          amount: number | string;
          currency: string;
          direction: "in" | "out";
          counterparty?: string | null;
          note: string;
          merchant_category_code?: string | null;
          balance_after?: number | string | null;
          intraday_index?: number;
          status?: "pending" | "imported" | "ignored";
          transaction_id?: string | null;
          decided_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider_id?: string;
          provider_account_id?: string;
          occurred_on?: string;
          amount?: number | string;
          currency?: string;
          direction?: "in" | "out";
          counterparty?: string | null;
          note?: string;
          merchant_category_code?: string | null;
          balance_after?: number | string | null;
          intraday_index?: number;
          status?: "pending" | "imported" | "ignored";
          transaction_id?: string | null;
          decided_by?: string | null;
          created_at?: string;
        };
        // The foreign key migration 019 actually declares. It was missing
        // here, and `getDecidedFeedItems` selects through it — the cast on
        // that query only compiled because the client's relationship
        // resolver was bailing out early for want of a `Functions` member to
        // resolve against, and it started reporting the join as a missing
        // relation the moment one was added.
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
      month_closes: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          closing_balance: number;
          observed_on: string;
          /** Typed in by hand, or read off the statement. */
          balance_source: "manual" | "bank";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          closing_balance: number;
          observed_on: string;
          balance_source?: "manual" | "bank";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          closing_balance?: number;
          observed_on?: string;
          balance_source?: "manual" | "bank";
          created_at?: string;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          user_id: string;
          provider_account_id: string;
          label: string;
          currency: string;
          reported_balance: number | null;
          reported_on: string | null;
          needs_reconnect: boolean;
          counts_as_cash: boolean;
          first_seen_at: string;
          last_seen_at: string;
        };
        Insert: {
          user_id: string;
          provider_account_id: string;
          label: string;
          currency: string;
          reported_balance?: number | string | null;
          reported_on?: string | null;
          needs_reconnect?: boolean;
          counts_as_cash?: boolean;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Update: {
          user_id?: string;
          provider_account_id?: string;
          label?: string;
          currency?: string;
          reported_balance?: number | string | null;
          reported_on?: string | null;
          needs_reconnect?: boolean;
          counts_as_cash?: boolean;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      recurring_fulfilments: {
        Row: {
          user_id: string;
          template_id: string;
          occurred_on: string;
          transaction_id: string;
          confirmed_at: string;
        };
        Insert: {
          user_id: string;
          template_id: string;
          occurred_on: string;
          transaction_id: string;
          confirmed_at?: string;
        };
        Update: {
          user_id?: string;
          template_id?: string;
          occurred_on?: string;
          transaction_id?: string;
          confirmed_at?: string;
        };
        Relationships: [];
      };
      recurring_fulfilment_refusals: {
        Row: {
          user_id: string;
          template_id: string;
          occurred_on: string;
          transaction_id: string;
          refused_at: string;
        };
        Insert: {
          user_id: string;
          template_id: string;
          occurred_on: string;
          transaction_id: string;
          refused_at?: string;
        };
        Update: {
          user_id?: string;
          template_id?: string;
          occurred_on?: string;
          transaction_id?: string;
          refused_at?: string;
        };
        Relationships: [];
      };
      month_reads: {
        Row: {
          user_id: string;
          month: string;
          writes: number;
          refused: number;
          last_written_at: string | null;
          pending_since: string | null;
          read: Json | null;
          facts: Json | null;
          facts_digest: string | null;
          trimmed: number;
          model: string | null;
          prompt_version: number | null;
          written_at: string | null;
          source: "pressed" | "auto";
        };
        Insert: {
          user_id: string;
          month: string;
          writes?: number;
          refused?: number;
          last_written_at?: string | null;
          pending_since?: string | null;
          read?: Json | null;
          facts?: Json | null;
          facts_digest?: string | null;
          trimmed?: number;
          model?: string | null;
          prompt_version?: number | null;
          written_at?: string | null;
          source?: "pressed" | "auto";
        };
        Update: {
          user_id?: string;
          month?: string;
          writes?: number;
          refused?: number;
          last_written_at?: string | null;
          pending_since?: string | null;
          read?: Json | null;
          facts?: Json | null;
          facts_digest?: string | null;
          trimmed?: number;
          model?: string | null;
          prompt_version?: number | null;
          written_at?: string | null;
          source?: "pressed" | "auto";
        };
        Relationships: [];
      };
      bank_pulls: {
        Row: {
          user_id: string;
          pulled_on: string;
          unattended: number;
          attended: number;
          last_pulled_at: string;
        };
        Insert: {
          user_id: string;
          pulled_on: string;
          unattended?: number;
          attended?: number;
          last_pulled_at?: string;
        };
        Update: {
          user_id?: string;
          pulled_on?: string;
          unattended?: number;
          attended?: number;
          last_pulled_at?: string;
        };
        Relationships: [];
      };
      month_close_settings: {
        Row: {
          user_id: string;
          close_day: number;
          unrecorded_cap: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          close_day?: number;
          unrecorded_cap?: number | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          close_day?: number;
          unrecorded_cap?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallet_plans: {
        Row: {
          user_id: string;
          wallet: WalletId;
          target_weight: number | null;
          opened_on: string | null;
          contribution_ceiling: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          wallet: WalletId;
          target_weight?: number | null;
          opened_on?: string | null;
          contribution_ceiling?: number | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          wallet?: WalletId;
          target_weight?: number | null;
          opened_on?: string | null;
          contribution_ceiling?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /**
       * Count one pull of the bank, atomically.
       *
       * A function rather than a read-then-write, so two refreshes racing
       * cannot both read 2 and write 3.
       */
      /** Take one attempt at writing a month read, if the allowance permits. */
      reserve_month_read: {
        Args: {
          target_user: string;
          target_month: string;
          allowance: number;
          cooldown_seconds: number;
          reservation_seconds: number;
        };
        Returns: {
          user_id: string;
          month: string;
          writes: number;
          refused: number;
          last_written_at: string | null;
          pending_since: string | null;
          read: Json | null;
          facts: Json | null;
          facts_digest: string | null;
          trimmed: number;
          model: string | null;
          prompt_version: number | null;
          written_at: string | null;
          source: "pressed" | "auto";
        };
      };
      /** Land a finished attempt, whether or not a read survived it. */
      store_month_read: {
        Args: {
          target_user: string;
          target_month: string;
          new_read: Json | null;
          new_facts: Json | null;
          new_digest: string | null;
          new_trimmed: number;
          new_model: string | null;
          new_prompt_version: number | null;
          refused_delta: number;
          new_source: string;
        };
        Returns: {
          user_id: string;
          month: string;
          writes: number;
          refused: number;
          last_written_at: string | null;
          pending_since: string | null;
          read: Json | null;
          facts: Json | null;
          facts_digest: string | null;
          trimmed: number;
          model: string | null;
          prompt_version: number | null;
          written_at: string | null;
          source: "pressed" | "auto";
        };
      };
      /** Hand back an attempt that never reached the provider. */
      refund_month_read: {
        Args: { target_user: string; target_month: string };
        Returns: {
          user_id: string;
          month: string;
          writes: number;
          refused: number;
          last_written_at: string | null;
          pending_since: string | null;
          read: Json | null;
          facts: Json | null;
          facts_digest: string | null;
          trimmed: number;
          model: string | null;
          prompt_version: number | null;
          written_at: string | null;
          source: "pressed" | "auto";
        };
      };
      record_bank_pull: {
        Args: {
          target_user: string;
          was_attended: boolean;
          today: string;
        };
        // Spelled out rather than pointed at the table's own Row. Referring
        // to `Database[...]` from inside `Database` is circular, and while
        // TypeScript tolerates it, the resolver gives up part-way and
        // PostgREST's relationship inference — which reads this same
        // interface — starts reporting joins it had previously resolved as
        // missing relations.
        Returns: {
          user_id: string;
          pulled_on: string;
          unattended: number;
          attended: number;
          last_pulled_at: string;
        };
      };
    };
    Enums: {
      category_type: CategoryType;
      recurrence_type: Recurrence;
      pricing_type: PricingType;
      investment_wallet: WalletId;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type RecurringTemplate =
  Database["public"]["Tables"]["recurring_templates"]["Row"];
export type RecurringSkip =
  Database["public"]["Tables"]["recurring_skips"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type InvestmentPosition =
  Database["public"]["Tables"]["investment_positions"]["Row"];
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type WalletTransfer =
  Database["public"]["Tables"]["wallet_transfers"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type SavingsGoal = Database["public"]["Tables"]["savings_goals"]["Row"];
export type WalletPlan = Database["public"]["Tables"]["wallet_plans"]["Row"];
export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type BankFeedItem =
  Database["public"]["Tables"]["bank_feed_items"]["Row"];
export type BankAccount = Database["public"]["Tables"]["bank_accounts"]["Row"];
export type BankPullRow = Database["public"]["Tables"]["bank_pulls"]["Row"];
export type MonthReadRow = Database["public"]["Tables"]["month_reads"]["Row"];
export type RecurringFulfilment =
  Database["public"]["Tables"]["recurring_fulfilments"]["Row"];
export type MonthClose = Database["public"]["Tables"]["month_closes"]["Row"];
export type MonthCloseSettings =
  Database["public"]["Tables"]["month_close_settings"]["Row"];

export type RecurringTemplateWithCategory = RecurringTemplate & {
  categories: Pick<
    Category,
    "name" | "type" | "icon" | "counts_toward_summary"
  >;
};

export type TransactionWithCategory = Transaction & {
  categories: Pick<
    Category,
    "name" | "type" | "icon" | "counts_toward_summary"
  >;
};

export interface CategoryBreakdown {
  categoryId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  total: number;
}

export interface MonthlySummary {
  income: number;
  expenses: number;
  savings: number;
  investments: number;
  investmentDeployments: number;
  remaining: number;
  budgetView: BudgetViewMode;
  expenseBreakdown: CategoryBreakdown[];
  savingsBreakdown: CategoryBreakdown[];
  investmentBreakdown: CategoryBreakdown[];
  investmentDeploymentBreakdown: CategoryBreakdown[];
}
