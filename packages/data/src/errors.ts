/**
 * A database refusal, as the message a person should read.
 *
 * Every shared write used to hand Postgres' own wording straight back, so a
 * French reader's toast could say "duplicate key value violates unique
 * constraint". The codes a person can cause, or can do something about, get
 * a catalogue key of their own; anything else is "could not be saved", with
 * the real text logged for whoever looks into it.
 *
 * A network failure keeps a key with "offline" in it, which is what the
 * web's outbox (`isRetryableError`) reads as "hold it and send it later".
 */
export function dbError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "23505":
      return "errors.alreadyThere";
    case "23503":
      return "errors.stillInUse";
    case "42501":
    case "PGRST301":
      return "errors.notAllowed";
    case "PGRST116":
      return "errors.notFound";
  }

  const text = (error.message ?? "").toLowerCase();
  if (
    text.includes("fetch") ||
    text.includes("network") ||
    text.includes("timeout") ||
    text.includes("connection")
  ) {
    return "errors.offline";
  }

  console.warn("[data] write refused:", error.code ?? "", error.message ?? "");
  return "errors.couldNotSave";
}
