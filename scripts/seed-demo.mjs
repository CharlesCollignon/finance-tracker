#!/usr/bin/env node
// Makes the demo account (migration 081, docs/plans/REFERENCE_APP_PLAN.md
// Phase 10): one auth user marked `{"demo": true}`, then the sample built
// for today through the web's /api/cron/demo — the same reset the nightly
// cron runs.
//
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//   DEMO_EMAIL=… DEMO_PASSWORD=… CRON_SECRET=… \
//   node scripts/seed-demo.mjs [--url=https://pluclair.com]
//
// The same DEMO_EMAIL and DEMO_PASSWORD go into Vercel's Production
// environment: that is what « Essayer la démo » signs a visitor in with.
// Run it again to re-seed; an account already there is kept, its metadata
// and password set afresh. Prints what it did; never prints the password.

const siteUrl =
  process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ??
  "https://pluclair.com";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.DEMO_EMAIL?.trim();
const password = process.env.DEMO_PASSWORD?.trim();
const cronSecret = process.env.CRON_SECRET?.trim();
if (!supabaseUrl || !serviceKey || !email || !password) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL and DEMO_PASSWORD first.",
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error("DEMO_PASSWORD: twelve characters at least — the account is public.");
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

async function admin(method, path, body) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase answered ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** The user by e-mail, paging through the list: a small app, a short list. */
async function findUser() {
  for (let page = 1; page < 50; page += 1) {
    const listed = await admin("GET", `/users?page=${page}&per_page=200`);
    const users = listed?.users ?? [];
    const found = users.find(
      (user) => (user.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found) {
      return found;
    }
    if (users.length < 200) {
      return null;
    }
  }
  return null;
}

const metadata = {
  app_metadata: { demo: true, provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Camille" },
};

let user = await findUser();
if (user) {
  await admin("PUT", `/users/${user.id}`, { password, email_confirm: true, ...metadata });
  console.log(`Already there: ${email} (${user.id}); password and metadata set afresh.`);
} else {
  user = await admin("POST", "/users", {
    email,
    password,
    email_confirm: true,
    ...metadata,
  });
  console.log(`Made the demo account ${email} (${user.id}).`);
}

if (!cronSecret) {
  console.log(
    `Set CRON_SECRET to seed it now; else the nightly reset at ${siteUrl}/api/cron/demo will.`,
  );
  process.exit(0);
}

const seeded = await fetch(`${siteUrl}/api/cron/demo`, {
  headers: { authorization: `Bearer ${cronSecret}` },
});
const result = await seeded.json().catch(() => null);
if (!seeded.ok || !result || result.error) {
  console.error(
    `The reset at ${siteUrl}/api/cron/demo answered ${seeded.status}: ${JSON.stringify(result)}`,
  );
  process.exit(1);
}
if (result.skipped) {
  console.log(`Not seeded: ${result.skipped}`);
  process.exit(1);
}
console.log(
  `Seeded for today: ${result.transactions} entries, ${result.templates} recurring, ${result.positions} positions, ${result.events} operations.`,
);
