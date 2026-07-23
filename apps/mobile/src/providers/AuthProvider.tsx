import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { seedDefaultCategories } from "@/lib/seed-categories";
import { supabase } from "@/lib/supabase";

type AuthResult = { error?: string };

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session has been restored from storage. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          return { error: error.message };
        }
        // Covers users who confirmed via email after signup (no seed yet).
        if (data.user) {
          await seedDefaultCategories(data.user.id);
        }
        return {};
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          return { error: error.message };
        }
        // If email confirmation is on, there is no session yet.
        if (data.user && !data.session) {
          return {
            error:
              "Check your email to confirm your account, then sign in.",
          };
        }
        if (data.user) {
          await seedDefaultCategories(data.user.id);
        }
        return {};
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
