import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mailgunMail, mailgunSigned } from "./mailgun";

const KEY = "signing-key";
const NOW = Date.UTC(2026, 9, 12, 21, 30);

function signed(fields: Record<string, string | File>, timestamp = String(NOW / 1000)) {
  const form = new FormData();
  const token = "a".repeat(50);
  form.set("timestamp", timestamp);
  form.set("token", token);
  form.set("signature", createHmac("sha256", KEY).update(timestamp + token).digest("hex"));
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }
  return form;
}

describe("mailgunSigned", () => {
  it("takes a request Mailgun signed, recently", () => {
    expect(mailgunSigned(signed({}), KEY, NOW)).toBe(true);
  });

  it("refuses another key, a changed signature, and an old request", () => {
    expect(mailgunSigned(signed({}), "other", NOW)).toBe(false);
    const form = signed({});
    form.set("signature", "0".repeat(64));
    expect(mailgunSigned(form, KEY, NOW)).toBe(false);
    expect(mailgunSigned(signed({}, String(NOW / 1000 - 3600)), KEY, NOW)).toBe(false);
    expect(mailgunSigned(new FormData(), KEY, NOW)).toBe(false);
  });
});

describe("mailgunMail", () => {
  it("reads the route's fields as an e-mail, attachments ready to read", async () => {
    const mail = mailgunMail(
      signed({
        recipient: "abcdefghij12@releves.pluclair.com",
        sender: "bounce@boursobank.com",
        from: "BoursoBank <alertes@boursobank.com>",
        subject: "Votre relevé",
        "body-plain": "Bonjour",
        "body-html": "<p>Bonjour</p>",
        "message-headers": JSON.stringify([
          ["Message-Id", "<abc@boursobank.com>"],
          ["Date", "Mon, 12 Oct 2026 21:30:00 +0000"],
        ]),
        "attachment-count": "1",
        "attachment-1": new File([new Uint8Array([1, 2, 3])], "releve.pdf", {
          type: "application/pdf",
        }),
      }),
    );
    expect(mail).toMatchObject({
      id: "<abc@boursobank.com>",
      recipients: ["abcdefghij12@releves.pluclair.com"],
      from: "BoursoBank <alertes@boursobank.com>",
      subject: "Votre relevé",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
      // 21:30 UTC is 23:30 in Paris: still the 12th, the day it arrived.
      receivedOn: "2026-10-12",
    });
    expect(mail.attachments.map((one) => [one.name, one.size])).toEqual([["releve.pdf", 3]]);
    expect(await mail.attachments[0]!.bytes()).toEqual(new Uint8Array([1, 2, 3]));
  });
});
