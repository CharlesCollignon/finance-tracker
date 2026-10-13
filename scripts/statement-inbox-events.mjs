#!/usr/bin/env node
// What Brevo's inbound parsing has received lately: date, sender and
// recipient of each e-mail, never its content — to tell whether an e-mail
// sent to …@releves.pluclair.com reached Brevo at all, and then whether the
// webhook went to Pluclair.
//
//   BREVO_API_KEY=… node scripts/statement-inbox-events.mjs [hours=24]

const key = process.env.BREVO_API_KEY;
if (!key || !/^[\x21-\x7e]+$/.test(key)) {
  console.error("Set BREVO_API_KEY to the real key first.");
  process.exit(1);
}
const hours = Number(process.argv[2] ?? 24);
const day = (date) => date.toISOString().slice(0, 10);
const end = new Date();
const start = new Date(end.getTime() - hours * 3_600_000);
const headers = { "api-key": key, accept: "application/json" };

const response = await fetch(
  `https://api.brevo.com/v3/inbound/events?startDate=${day(start)}&endDate=${day(end)}&limit=50&sort=desc`,
  { headers },
);
const text = await response.text();
if (!response.ok) {
  console.error(`Brevo answered ${response.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}
const events = JSON.parse(text)?.events ?? [];
if (events.length === 0) {
  console.log(`Brevo received no inbound e-mail between ${day(start)} and ${day(end)}.`);
  process.exit(0);
}
for (const event of events) {
  console.log(`${event.date}  from ${event.sender}  to ${event.recipient}  (${event.uuid})`);
}
// The first one in detail: what Brevo did with it, the webhook's answer included.
const first = events[0];
const detail = await fetch(`https://api.brevo.com/v3/inbound/events/${first.uuid}`, { headers });
if (detail.ok) {
  const body = await detail.json();
  console.log("\nLatest, step by step:");
  for (const log of body.logs ?? []) {
    console.log(`  ${log.date}  ${log.type}`);
  }
  if (body.attachments?.length) {
    console.log(`  attachments: ${body.attachments.map((one) => one.name).join(", ")}`);
  }
}
