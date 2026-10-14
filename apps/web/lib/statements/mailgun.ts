import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { isoDateInAppTimeZone } from "@finance/core/constants";
import type { InboundMail } from "./mail-in";

/**
 * Mailgun's inbound route (`forward()` to `/api/statements/inbound`), as the
 * rest of the app takes an e-mail: who it was for, who sent it, its words,
 * its attachments — all in the one request, read once and let go of.
 * Mailgun is the one place that knows its own shape; another inbound
 * service would be another file like this one.
 */

/** How old a signed request may be: Mailgun's own retries are newly signed. */
const FRESH_SECONDS = 15 * 60;

/**
 * Whether Mailgun sent this: `signature` is the HMAC-SHA256 of `timestamp`
 * and `token` under the account's webhook signing key, and the timestamp is
 * recent — a request copied and replayed later is refused.
 */
export function mailgunSigned(form: FormData, key: string, now = Date.now()): boolean {
  const timestamp = String(form.get("timestamp") ?? "");
  const token = String(form.get("token") ?? "");
  const signature = String(form.get("signature") ?? "");
  if (!/^\d+$/.test(timestamp) || !token || !/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }
  if (Math.abs(now / 1000 - Number(timestamp)) > FRESH_SECONDS) {
    return false;
  }
  const expected = createHmac("sha256", key).update(timestamp + token).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** A header among Mailgun's `message-headers`: `[["Date", "…"], …]`. */
function header(headers: unknown, name: string): string | null {
  if (!Array.isArray(headers)) {
    return null;
  }
  const found = headers.find(
    (pair) => Array.isArray(pair) && String(pair[0]).toLowerCase() === name.toLowerCase(),
  );
  return found ? String(found[1]) : null;
}

/** The e-mail one call of the route carries. */
export function mailgunMail(form: FormData): InboundMail {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  let headers: unknown = null;
  try {
    headers = JSON.parse(text("message-headers") || "null");
  } catch {
    headers = null;
  }
  const sent = new Date(header(headers, "Date") ?? Date.now());
  const count = Number(text("attachment-count") || 0);
  const attachments: InboundMail["attachments"] = [];
  for (let index = 1; index <= Math.min(count, 20); index += 1) {
    const file = form.get(`attachment-${index}`);
    if (file instanceof File) {
      attachments.push({
        name: file.name,
        type: file.type,
        size: file.size,
        bytes: async () => new Uint8Array(await file.arrayBuffer()),
      });
    }
  }
  return {
    id:
      header(headers, "Message-Id") ??
      `${text("timestamp")}|${text("token")}`,
    recipients: text("recipient")
      .split(",")
      .map((one) => one.trim())
      .filter(Boolean),
    from: text("from") || text("sender"),
    subject: text("subject"),
    text: text("body-plain"),
    html: text("body-html") || null,
    receivedOn: isoDateInAppTimeZone(Number.isNaN(sent.getTime()) ? new Date() : sent),
    attachments,
  };
}
