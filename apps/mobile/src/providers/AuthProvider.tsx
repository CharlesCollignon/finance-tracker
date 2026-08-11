import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
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

WebBrowser.maybeCompleteAuthSession();

type AuthResult = { error?: string };

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session has been restored from storage. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
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

    const linkingSub = Linking.addEventListener("url", async ({ url }) => {
      await handleAuthUrl(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleAuthUrl(url);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      linkingSub.remove();
    };
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
          await seedCategoriesSafely(data.user.id);
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
            error: "Check your email to confirm your account, then sign in.",
          };
        }
        if (data.user) {
          await seedCategoriesSafely(data.user.id);
        }
        return {};
      },
      async signInWithGoogle() {
        const redirectTo = Linking.createURL("auth/callback");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          return { error: error.message };
        }
        if (!data.url) {
          return { error: "Could not start Google sign-in." };
        }

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
        );

        if (result.type !== "success" || !result.url) {
          return { error: "Google sign-in was cancelled." };
        }

        const ok = await handleAuthUrl(result.url);
        if (!ok) {
          return { error: "Could not complete Google sign-in." };
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

async function seedCategoriesSafely(userId: string): Promise<void> {
  try {
    await seedDefaultCategories(userId);
  } catch (error) {
    console.error("Failed to seed default categories", error);
  }
}

async function handleAuthUrl(url: string): Promise<boolean> {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const code = typeof params.code === "string" ? params.code : null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return false;
    }
    await seedCategoriesSafely(data.user.id);
    return true;
  }

  // Some providers return tokens in the hash fragment.
  const hash = url.split("#")[1];
  if (!hash) {
    return false;
  }
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return false;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.user) {
    return false;
  }
  await seedCategoriesSafely(data.user.id);
  return true;
}
