// Supabase Edge Function: delete-account
// Deploy with: supabase functions deploy delete-account --no-verify-jwt=false
// Requires SUPABASE_SERVICE_ROLE_KEY in the function secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin =
    origin && (allowed.length === 0 || allowed.includes(origin))
      ? origin
      : allowed[0] ?? "";

  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401, headers);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== "DELETE") {
      return json({ error: "Type DELETE to confirm" }, 400, headers);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRole) {
      return json(
        { error: "Account deletion is not configured on the server." },
        503,
        headers,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Not authenticated" }, 401, headers);
    }

    const admin = createClient(supabaseUrl, serviceRole);

    const { data: txs } = await admin
      .from("transactions")
      .select("id")
      .eq("user_id", user.id);
    const txIds = (txs ?? []).map((t: { id: string }) => t.id);
    if (txIds.length > 0) {
      await admin.from("transaction_tags").delete().in("transaction_id", txIds);
    }
    await admin.from("tags").delete().eq("user_id", user.id);
    await admin.from("budgets").delete().eq("user_id", user.id);
    await admin.from("wallet_transfers").delete().eq("user_id", user.id);
    await admin.from("savings_goals").delete().eq("user_id", user.id);
    await admin.from("recurring_skips").delete().eq("user_id", user.id);
    await admin.from("transactions").delete().eq("user_id", user.id);
    await admin.from("investment_positions").delete().eq("user_id", user.id);
    await admin.from("recurring_templates").delete().eq("user_id", user.id);
    await admin.from("categories").delete().eq("user_id", user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return json({ error: deleteError.message }, 500, headers);
    }

    return json({ success: true }, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return json({ error: message }, 500, headers);
  }
});

function json(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
