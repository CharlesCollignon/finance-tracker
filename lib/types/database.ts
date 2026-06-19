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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: CategoryType;
          icon?: string | null;
          counts_toward_summary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: CategoryType;
          icon?: string | null;
          counts_toward_summary?: boolean;
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
        ];
      };
      investment_wallets: {
        Row: {
          user_id: string;
          wallet: WalletId;
          initial_balance: number;
          current_value: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          wallet: WalletId;
          initial_balance?: number;
          current_value?: number | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          wallet?: WalletId;
          initial_balance?: number;
          current_value?: number | null;
          updated_at?: string;
        };
        Relationships: [];
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
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      category_type: CategoryType;
      recurrence_type: Recurrence;
      wallet_id: WalletId;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type RecurringTemplate =
  Database["public"]["Tables"]["recurring_templates"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type InvestmentWallet =
  Database["public"]["Tables"]["investment_wallets"]["Row"];
export type InvestmentPosition =
  Database["public"]["Tables"]["investment_positions"]["Row"];

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
  expenseBreakdown: CategoryBreakdown[];
  savingsBreakdown: CategoryBreakdown[];
  investmentBreakdown: CategoryBreakdown[];
  investmentDeploymentBreakdown: CategoryBreakdown[];
}
