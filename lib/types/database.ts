export type CategoryType = "income" | "expense" | "savings" | "investment";

export type Recurrence = "monthly" | "weekly";

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
          recurrence: Recurrence;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          day_of_month?: number | null;
          day_of_week?: number | null;
          recurrence?: Recurrence;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          day_of_month?: number | null;
          day_of_week?: number | null;
          recurrence?: Recurrence;
          active?: boolean;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      category_type: CategoryType;
      recurrence_type: Recurrence;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type RecurringTemplate =
  Database["public"]["Tables"]["recurring_templates"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

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
