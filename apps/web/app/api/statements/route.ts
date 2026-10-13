import { firstIssue } from "@finance/core/action-result";
import { statementImportSchema } from "@finance/core/validations/statements";
import { planStatement, undoStatement } from "@/lib/statements/service";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * A statement brought on the phone: the same preview, import and undo the
 * web's actions run (`lib/actions/statements.ts`), as the bearer token's
 * person. The phone reads the file itself; the bank feed's planner, which
 * needs the server, decides its lines here.
 *
 * `owner` is the space under « Commun », checked against the person's
 * membership before anything is read or written for it.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const ownerId = typeof body.owner === "string" ? body.owner : session.userId;
  if (ownerId !== session.userId) {
    const { data: member } = await session.supabase
      .from("space_members")
      .select("space_id")
      .eq("space_id", ownerId)
      .eq("user_id", session.userId)
      .maybeSingle();
    if (!member) {
      return Response.json({ error: "errors.notAllowed" }, { status: 403 });
    }
  }

  if (body.action === "undo") {
    const importId = typeof body.importId === "string" ? body.importId : "";
    if (!/^[0-9a-f-]{36}$/.test(importId)) {
      return Response.json({ error: "errors.invalidInput" });
    }
    return Response.json(
      await undoStatement(session.supabase, ownerId, importId),
    );
  }

  if (body.action !== "preview" && body.action !== "import") {
    return Response.json({ error: "errors.invalidInput" });
  }
  const parsed = statementImportSchema.safeParse(body.statement);
  if (!parsed.success) {
    return Response.json({ error: firstIssue(parsed.error) });
  }
  return Response.json(
    await planStatement(
      session.supabase,
      { userId: session.userId, ownerId },
      parsed.data,
      { write: body.action === "import" },
    ),
  );
}
