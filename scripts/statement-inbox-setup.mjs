#!/usr/bin/env node
// Makes Mailgun (EU region) hand every e-mail sent to …@releves.pluclair.com
// to Pluclair (docs/plans/STATEMENTS_PLAN.md, Phase 4): one inbound route,
// forwarding each e-mail to the webhook, which checks Mailgun's signature
// with MAILGUN_WEBHOOK_SIGNING_KEY (set in Vercel).
//
//   MAILGUN_API_KEY=… node scripts/statement-inbox-setup.mjs [--replace]
//
// Never prints the key.

const API = "https://api.eu.mailgun.net/v3/routes";
const DOMAIN = "releves.pluclair.com";
const url =
  process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ??
  "https://pluclair.com/api/statements/inbound";
const replace = process.argv.includes("--replace");

const key = process.env.MAILGUN_API_KEY;
if (!key || !/^[\x21-\x7e]+$/.test(key)) {
  console.error("Set MAILGUN_API_KEY to the real key first (without « … »).");
  process.exit(1);
}
const auth = { authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}` };

async function call(method, path = "", body) {
  const response = await fetch(`${API}${path}`, { method, headers: auth, body });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Mailgun answered ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const listed = await call("GET", "?limit=100");
const ours = (listed?.items ?? []).filter((route) => route.expression?.includes(DOMAIN));

if (ours.length > 0 && !replace) {
  for (const route of ours) {
    console.log(`Already there: route ${route.id} — ${route.expression} → ${route.actions.join(", ")}`);
  }
  console.log("Run again with --replace to make it anew.");
  process.exit(0);
}
for (const route of ours) {
  await call("DELETE", `/${route.id}`);
  console.log(`Deleted route ${route.id}.`);
}

const form = new FormData();
form.set("priority", "0");
form.set("description", "Pluclair — relevés par e-mail");
form.set("expression", `match_recipient(".*@${DOMAIN.replace(/\./g, "\\.")}")`);
form.append("action", `forward("${url}")`);
form.append("action", "stop()");
const made = await call("POST", "", form);
console.log(`Made route ${made?.route?.id}: e-mails to …@${DOMAIN} go to ${url}.`);
