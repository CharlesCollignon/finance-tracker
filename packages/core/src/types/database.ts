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
          amount: number;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
export type SavingsGoal =
  Database["public"]["Tables"]["savings_goals"]["Row"];

export type RecurringTemplateWithCategory = RecurringTemplate & {
  categories: Pick<Category, "name" | "type" | "icon" | "counts_toward_summary">;
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
