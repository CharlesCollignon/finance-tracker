#!/usr/bin/env node
// What Mailgun (EU region) has seen for …@releves.pluclair.com lately: each
// e-mail accepted, and how forwarding it to Pluclair went — date, event,
// sender, recipient and status, never the content.
//
//   MAILGUN_API_KEY=… node scripts/statement-inbox-events.mjs

const DOMAIN = "releves.pluclair.com";
const key = process.env.MAILGUN_API_KEY;
if (!key || !/^[\x21-\x7e]+$/.test(key)) {
  console.error("Set MAILGUN_API_KEY to the real key first (without « … »).");
  process.exit(1);
}
const response = await fetch(`https://api.eu.mailgun.net/v3/${DOMAIN}/events?limit=30&ascending=no`, {
  headers: { authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}` },
});
const text = await response.text();
if (!response.ok) {
  console.error(`Mailgun answered ${response.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}
const items = JSON.parse(text)?.items ?? [];
if (items.length === 0) {
  console.log(`Mailgun has seen nothing for ${DOMAIN} yet.`);
}
for (const item of items) {
  const when = new Date(item.timestamp * 1000).toISOString().replace("T", " ").slice(0, 19);
  const status = item["delivery-status"];
  const said = status ? ` — ${status.code ?? ""} ${status.message ?? status.description ?? ""}`.trimEnd() : "";
  console.log(
    `${when}  ${item.event}  from ${item.message?.headers?.from ?? item.envelope?.sender ?? "?"}  to ${item.recipient ?? "?"}${said}${item.reason ? ` (${item.reason})` : ""}`,
  );
}
