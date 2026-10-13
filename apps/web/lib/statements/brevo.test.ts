import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { brevoMails } from "./brevo";

describe("brevoMails", () => {
  it("reads Brevo's inbound items as e-mails, attachments fetched on demand", async () => {
    process.env.BREVO_API_KEY = "key";
    const fetched = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetched);
    const [mail] = brevoMails({
      items: [
        {
          Uuid: ["uuid-1"],
          MessageId: "<abc@boursobank.com>",
          Recipients: ["abcdefghij12@releves.pluclair.com"],
          To: [{ Address: "moi@gmail.com", Name: "Moi" }],
          From: { Address: "alertes@boursobank.com", Name: "BoursoBank" },
          Subject: "Votre relevé",
          SentAtDate: "Mon, 12 Oct 2026 21:30:00 +0000",
          RawTextBody: "Bonjour",
          RawHtmlBody: "<p>Bonjour</p>",
          Attachments: [
            { Name: "releve.pdf", ContentType: "application/pdf", ContentLength: 3, DownloadToken: "tok/1" },
            { Name: "logo.png", ContentType: "image/png", ContentLength: 9 },
          ],
        },
      ],
    });
    expect(mail).toMatchObject({
      id: "<abc@boursobank.com>",
      recipients: ["abcdefghij12@releves.pluclair.com", "moi@gmail.com"],
      from: "alertes@boursobank.com",
      subject: "Votre relevé",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
      // 21:30 UTC is 23:30 in Paris: still the 12th, the day it arrived.
      receivedOn: "2026-10-12",
    });
    expect(mail!.attachments.map((one) => one.name)).toEqual(["releve.pdf"]);
    expect(await mail!.attachments[0]!.bytes()).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetched).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/inbound/attachments/tok%2F1",
      expect.objectContaining({ headers: expect.objectContaining({ "api-key": "key" }) }),
    );
    vi.unstubAllGlobals();
  });

  it("is nothing for a body that is not Brevo's", () => {
    expect(brevoMails(null)).toEqual([]);
    expect(brevoMails({ items: "no" })).toEqual([]);
  });
});
