import { firstIssue } from "@finance/core/action-result";
import { readStatementFile } from "@finance/core/statement";
import {
  MAX_SENT_FILE_BYTES,
  statementImportSchema,
} from "@finance/core/validations/statements";
import { readPdfStatement } from "@/lib/statements/pdf";
import { scanStatement } from "@/lib/statements/scan";
import { planStatement, undoStatement } from "@/lib/statements/service";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * A statement brought on the phone: the same preview, import and undo the
 * web's actions run (`lib/actions/statements.ts`), as the bearer token's
 * person. The phone reads the file itself; the bank feed's planner, which
 * needs the server, decides its lines here. A PDF is read here
 * (`readPdf`), and a picture or a scan by the person's AI account when they
 * say so (`scan`) — the file sent as base64.
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

  if (body.action === "readPdf" || body.action === "scan") {
    const bytes = new Uint8Array(
      Buffer.from(typeof body.file === "string" ? body.file : "", "base64"),
    );
    if (bytes.length > MAX_SENT_FILE_BYTES) {
      return Response.json({ error: "statements.tooBigToSend" });
    }
    const format = readStatementFile(bytes).format;
    if (body.action === "readPdf") {
      return format === "pdf"
        ? Response.json({ success: true, statement: await readPdfStatement(bytes) })
        : Response.json({ error: "errors.invalidInput" });
    }
    if (format !== "pdf" && format !== "image") {
      return Response.json({ error: "errors.invalidInput" });
    }
    const result = await scanStatement(session.userId, bytes, format);
    return Response.json(
      "error" in result ? result : { success: true, statement: result.statement },
    );
  }

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
