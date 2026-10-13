import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";
import type { EntraideTarget } from "@finance/core/entraide";
import { createAdminClient } from "@/lib/supabase/admin";

// An IPv4 or IPv6 address and nothing else: whatever a proxy wrote that is
// not one is not kept.
const IP = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{2,39})$/i;

/**
 * Who wrote, edited or deleted a question or an answer: the account, its
 * email address, the connection's address and the moment — kept a year,
 * read by no one but the service role, for the authorities that ask for it
 * lawfully (migration 073, the LCEN and decree no. 2021-1362).
 *
 * The address is read now, while the request is there; the row is written
 * after the reply has gone back. A row that cannot be written never undoes
 * the post it is about.
 */
export async function recordAuthorship(
  target: EntraideTarget,
  operation: "create" | "edit" | "delete",
  user: { id: string; email?: string | null },
): Promise<void> {
  const request = await headers();
  const forwarded = request.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || request.get("x-real-ip")?.trim() || "";
  const ip = IP.test(candidate) ? candidate : null;
  after(async () => {
    const admin = createAdminClient();
    if (!admin) {
      return;
    }
    const { error } = await admin.from("entraide_authorship").insert({
      target,
      operation,
      user_id: user.id,
      email: user.email ?? null,
      ip,
    });
    if (error) {
      console.warn("[entraide] authorship not recorded:", error.message);
    }
  });
}
