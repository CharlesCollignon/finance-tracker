import "server-only";

import { isoDateInAppTimeZone } from "@finance/core/constants";
import type { InboundMail } from "./mail-in";

/**
 * Brevo's inbound parsing (`inboundEmailProcessed`), as the rest of the
 * app takes an e-mail: who it was for, who sent it, its words, and its
 * attachments — fetched only when read, by the token Brevo gives each, and
 * never kept. Brevo is the one place that knows its own shape; another
 * inbound service would be another file like this one.
 */

const ATTACHMENTS = "https://api.brevo.com/v3/inbound/attachments";

interface BrevoMailbox {
  Address?: string;
  Name?: string;
}

interface BrevoItem {
  Uuid?: string[] | string;
  MessageId?: string;
  Recipients?: (string | BrevoMailbox)[];
  To?: (string | BrevoMailbox)[];
  From?: string | BrevoMailbox;
  Subject?: string;
  SentAtDate?: string;
  RawTextBody?: string;
  RawHtmlBody?: string;
  ExtractedMarkdownMessage?: string;
  Attachments?: {
    Name?: string;
    ContentType?: string;
    ContentLength?: number;
    DownloadToken?: string;
  }[];
}

function address(value: string | BrevoMailbox | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : (value.Address ?? "");
}

/** One attachment's bytes, from Brevo's API; null when it does not answer. */
async function attachmentBytes(token: string): Promise<Uint8Array | null> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${ATTACHMENTS}/${encodeURIComponent(token)}`, {
      headers: { "api-key": key, accept: "application/octet-stream" },
      signal: controller.signal,
    });
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The e-mails in one call of Brevo's webhook. */
export function brevoMails(body: unknown): InboundMail[] {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    return [];
  }
  return (items as BrevoItem[]).map((item) => {
    const uuid = Array.isArray(item.Uuid) ? item.Uuid[0] : item.Uuid;
    const sent = item.SentAtDate ? new Date(item.SentAtDate) : new Date();
    return {
      id: item.MessageId ?? uuid ?? `${item.SentAtDate ?? ""}|${item.Subject ?? ""}`,
      recipients: [...(item.Recipients ?? []), ...(item.To ?? [])]
        .map(address)
        .filter(Boolean),
      from: address(item.From),
      subject: item.Subject ?? "",
      text: item.RawTextBody ?? item.ExtractedMarkdownMessage ?? "",
      html: item.RawHtmlBody ?? null,
      receivedOn: isoDateInAppTimeZone(Number.isNaN(sent.getTime()) ? new Date() : sent),
      attachments: (item.Attachments ?? [])
        .filter((attachment) => attachment.DownloadToken)
        .map((attachment) => ({
          name: attachment.Name ?? "",
          type: attachment.ContentType ?? "",
          size: attachment.ContentLength ?? 0,
          bytes: () => attachmentBytes(attachment.DownloadToken!),
        })),
    };
  });
}
