import { firstIssue } from "@finance/core/action-result";
import { readStatementFile } from "@finance/core/statement";
import {
  MAX_SENT_FILE_BYTES,
  statementAccountSchema,
  statementImportSchema,
} from "@finance/core/validations/statements";
import {
  dismissMailItem,
  importMailItem,
  inboxView,
  renewInbox,
  startInbox,
  stopInbox,
} from "@/lib/statements/inbox";
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
 * say so (`scan`) — the file sent as base64. The e-mail way in is the
 * person's own, never their space's: their address (`inbox`, `inboxStart`,
 * `inboxStop`, `inboxRenew`) and what waits from it (`mailImport`,
 * `mailDismiss`).
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
        ? Response.json({
            success: true,
            statement: await readPdfStatement(bytes),
          })
        : Response.json({ error: "errors.invalidInput" });
    }
    if (format !== "pdf" && format !== "image") {
      return Response.json({ error: "errors.invalidInput" });
    }
    const result = await scanStatement(session.userId, bytes, format);
    return Response.json(
      "error" in result
        ? result
        : { success: true, statement: result.statement },
    );
  }

  switch (body.action) {
    case "inbox":
      return Response.json({
        success: true,
        ...(await inboxView(session.supabase, session.userId)),
      });
    case "inboxStart":
      return Response.json(await startInbox(session.userId));
    case "inboxStop":
      return Response.json(await stopInbox(session.userId));
    case "inboxRenew":
      return Response.json(await renewInbox(session.userId));
    case "mailDismiss":
    case "mailImport": {
      const itemId = typeof body.itemId === "string" ? body.itemId : "";
      if (!/^[0-9a-f-]{36}$/.test(itemId)) {
        return Response.json({ error: "errors.invalidInput" });
      }
      if (body.action === "mailDismiss") {
        return Response.json(await dismissMailItem(session.userId, itemId));
      }
      const account = statementAccountSchema.safeParse(body.account);
      if (!account.success) {
        return Response.json({ error: "errors.invalidInput" });
      }
      return Response.json(
        await importMailItem(session.userId, itemId, {
          account: account.data,
          direction: body.direction === "in" ? "in" : "out",
        }),
      );
    }
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
      {
        write: body.action === "import",
        // A notification's line, like an alert e-mail's, waits for the
        // statement that confirms it (`planStatement`).
        provisional: parsed.data.source === "notification",
      },
    ),
  );
}
