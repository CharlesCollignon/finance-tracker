#!/usr/bin/env node
// Makes Brevo hand every e-mail sent to …@releves.pluclair.com to Pluclair
// (docs/plans/STATEMENTS_PLAN.md, Phase 4): one inbound webhook, carrying
// the secret the web app checks (`x-pluclair-inbound`).
//
//   BREVO_API_KEY=… STATEMENT_INBOUND_SECRET=… node scripts/statement-inbox-setup.mjs
//
// The same two values go into Vercel's Production environment. Run it again
// with --replace after changing the secret: the old webhook is deleted and a
// new one made. Prints what it did; never prints either value.

const API = "https://api.brevo.com/v3/webhooks";
const DOMAIN = "releves.pluclair.com";
const url =
  process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ??
  "https://pluclair.com/api/statements/inbound";
const replace = process.argv.includes("--replace");

const key = process.env.BREVO_API_KEY;
const secret = process.env.STATEMENT_INBOUND_SECRET;
if (!key || !secret) {
  console.error("Set BREVO_API_KEY and STATEMENT_INBOUND_SECRET first.");
  process.exit(1);
}

const headers = { "api-key": key, accept: "application/json", "content-type": "application/json" };

async function call(method, path = "", body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo answered ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const listed = await call("GET", "?type=inbound");
const existing = (listed?.webhooks ?? []).filter((hook) => hook.domain === DOMAIN || hook.url === url);

if (existing.length > 0 && !replace) {
  for (const hook of existing) {
    console.log(`Already there: webhook ${hook.id} → ${hook.url} (${hook.domain ?? "no domain"}).`);
  }
  console.log("Run again with --replace to make it anew (after changing the secret).");
  process.exit(0);
}

for (const hook of existing) {
  await call("DELETE", `/${hook.id}`);
  console.log(`Deleted webhook ${hook.id}.`);
}

const made = await call("POST", "", {
  type: "inbound",
  events: ["inboundEmailProcessed"],
  url,
  domain: DOMAIN,
  description: "Pluclair — relevés par e-mail",
  headers: [{ key: "x-pluclair-inbound", value: secret }],
});
console.log(`Made webhook ${made?.id}: e-mails to …@${DOMAIN} go to ${url}.`);
