import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The proxy's choices about who goes where, with Supabase stubbed: which
 * user the session holds, and what signing out was asked to do.
 */
const auth = vi.hoisted(() => ({
  user: null as null | { id: string; app_metadata: Record<string, unknown> },
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: auth.user } }),
      signOut: auth.signOut,
    },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({ url: "https://x.supabase.co", anonKey: "anon" }),
}));

const { updateSession } = await import("./middleware");

const DEMO = { id: "demo", app_metadata: { demo: true } };
const OWN = { id: "own", app_metadata: {} };

function get(path: string) {
  return updateSession(new NextRequest(new URL(path, "https://pluclair.com")));
}

function redirectedTo(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("updateSession", () => {
  beforeEach(() => {
    auth.user = null;
    auth.signOut.mockClear();
  });

  it.each(["/signup", "/login"])(
    "ends a demo session on this browser only and opens %s",
    async (path) => {
      auth.user = DEMO;
      const response = await get(path);
      expect(redirectedTo(response)).toBeNull();
      expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    },
  );

  it.each(["/signup", "/login"])(
    "sends an account of one's own from %s to the app",
    async (path) => {
      auth.user = OWN;
      const response = await get(path);
      expect(redirectedTo(response)).toBe("/bearing");
      expect(auth.signOut).not.toHaveBeenCalled();
    },
  );

  it("keeps the demo session everywhere else in the app", async () => {
    auth.user = DEMO;
    const response = await get("/bearing");
    expect(redirectedTo(response)).toBeNull();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("still sends a visitor without a session to sign in", async () => {
    const response = await get("/bearing");
    expect(redirectedTo(response)).toBe("/login");
  });
});
