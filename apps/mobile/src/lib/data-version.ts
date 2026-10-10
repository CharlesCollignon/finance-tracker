import { useSyncExternalStore } from "react";

/**
 * Which part of the user's data a write touched, so a screen reloads for
 * what it reads and nothing else.
 *
 * Screens load their own data with `useRefreshable` — there is no client
 * cache — so something has to tell a screen that what it drew is out of
 * date. That used to be one counter every caller had to remember to bump,
 * and the ones that forgot were the bugs: an amount corrected on the Ledger
 * left Le point on the old balance, a category created in Profile was not in
 * the Add sheet. Now every write announces itself on the way through the
 * Supabase client and the web API wrapper (`areasWrittenTo` below), and the
 * area is the table it actually wrote to, so nobody has to remember anything.
 *
 * The web keeps the same map the other way round, as the pages each kind of
 * write revalidates (`apps/web/lib/revalidate-paths.ts`).
 */
export type DataArea =
  /** Transactions, and what decides a month's rows: skips, fulfilments. */
  | "transactions"
  /** Recurring templates. */
  | "templates"
  | "categories"
  /** Wallets, their positions and targets, and what their funds hold. */
  | "positions"
  /** Savings accounts. */
  | "accounts"
  /** Properties and their loans. */
  | "properties"
  /** The bank connection, its accounts, balances and review inbox. */
  | "bank"
  /** Month closes and their settings. */
  | "closes"
  /** Profile, language, dismissed invitations. */
  | "preferences"
  /** Month reads. */
  | "reads";

export const ALL_AREAS: readonly DataArea[] = [
  "transactions",
  "templates",
  "categories",
  "positions",
  "accounts",
  "properties",
  "bank",
  "closes",
  "preferences",
  "reads",
];

/**
 * The tables each area covers. A table missing from here counts as every
 * area, so a write nobody mapped reloads too much rather than too little.
 */
const TABLE_AREAS: Record<string, readonly DataArea[]> = {
  transactions: ["transactions"],
  recurring_skips: ["transactions"],
  recurring_fulfilments: ["transactions"],
  proposal_dismissals: ["transactions"],
  // A standing charge refused: Récurrents and Le point stop offering it.
  recurring_proposal_dismissals: ["templates", "bank"],
  recurring_templates: ["templates"],
  categories: ["categories"],
  investment_positions: ["positions"],
  wallet_plans: ["positions", "accounts"],
  instrument_readings: ["positions"],
  wallet_reads: ["positions"],
  savings_accounts: ["accounts"],
  properties: ["properties"],
  property_loans: ["properties"],
  bank_connections: ["bank"],
  bank_accounts: ["bank", "accounts"],
  bank_balances: ["bank"],
  bank_feed_items: ["bank", "transactions"],
  month_closes: ["closes"],
  month_close_settings: ["closes"],
  // A balance typed before any close: it anchors the month as a close does.
  balance_readings: ["closes"],
  user_preferences: ["preferences"],
  profiles: ["preferences"],
  month_reads: ["reads"],
  category_reads: ["reads"],
  category_read_tallies: ["reads"],
  category_selections: ["reads"],
  // Who writes the reads: Le point, the categories and the portfolio's
  // review all say so, and the Profile draws the connection.
  ai_connections: ["reads", "positions", "preferences"],
  // This device's push address. Nothing on screen draws it.
  expo_push_tokens: [],
  // Ask Pluclair's conversations: the Questions screen reloads its own.
  ask_conversations: [],
  ask_messages: [],
};

/**
 * Database functions that only read. An RPC goes as a POST whatever it does,
 * so without this list asking which flags are on would read as a write to
 * everything and reload every screen.
 */
const READ_RPCS: ReadonlySet<string> = new Set([
  "evaluated_feature_flags",
  // The shared space: what a link says, and who is in it.
  "peek_space_invite",
  "space_people",
]);

/**
 * Database functions that write something no screen draws: the audience
 * count (migration 058) is written on every return to the app, and reloading
 * every screen each time would be the opposite of what it is for.
 */
const UNDRAWN_RPCS: ReadonlySet<string> = new Set([
  "record_activity",
  // An invite link: nothing on screen draws one until it is used.
  "create_space_invite",
]);

/** Database functions that write one area only (migration 067). */
const RPC_AREAS: Record<string, readonly DataArea[]> = {
  reprice_occurrences: ["transactions"],
  set_feed_balances: ["bank"],
};

/** The web routes the phone writes through, by path. */
const ROUTE_AREAS: Record<string, readonly DataArea[]> = {
  "/api/bank/feed": ["bank", "transactions"],
  "/api/bank/consent": ["bank"],
  "/api/month-read": ["reads"],
  // A question asked: nothing but the Questions screen draws it.
  "/api/ask": [],
  "/api/ask/stream": [],
  "/api/category-read": ["reads"],
  "/api/category-rerank": ["reads"],
  "/api/instrument-reading": ["positions"],
  "/api/wallet-read": ["positions"],
  "/api/property/market": ["properties"],
  // Only the round trip's state, which nothing draws. The connection itself
  // is written by OpenRouter's callback, out of sight: see `ai-account.ts`.
  "/api/ai/openrouter/start": [],
};

/**
 * What a successful write to `url` changed, or null for a read.
 *
 * Supabase's REST endpoint names the table in the path (`/rest/v1/<table>`),
 * and only reads go as GET or HEAD. Anything else under `/rest/v1/` — an
 * RPC included — is a write; the auth endpoints (a token refresh is a POST)
 * are not data, and say nothing. A web route not in `ROUTE_AREAS` — a
 * connection, an import, a disconnect, a refresh — can move anything, so it
 * counts as all of it.
 */
function areasWrittenTo(
  url: string,
  method: string,
): readonly DataArea[] | null {
  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD") {
    return null;
  }
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const rest = path.match(/\/rest\/v1\/([^/?]+)(?:\/([^/?]+))?/);
  if (rest) {
    if (rest[1] === "rpc") {
      if (rest[2] && UNDRAWN_RPCS.has(rest[2])) {
        return [];
      }
      if (rest[2] && RPC_AREAS[rest[2]]) {
        return RPC_AREAS[rest[2]];
      }
      return rest[2] && READ_RPCS.has(rest[2]) ? null : ALL_AREAS;
    }
    return TABLE_AREAS[rest[1]] ?? ALL_AREAS;
  }
  if (path.includes("/auth/v1/")) {
    return null;
  }
  if (path.startsWith("/api/")) {
    return ROUTE_AREAS[path] ?? ALL_AREAS;
  }
  // An edge function — deleting the account is one — reaches anything.
  return path.includes("/functions/v1/") ? ALL_AREAS : null;
}

/**
 * `fetch`, announcing what a successful write changed.
 *
 * The Supabase client is built on it, and so is every call to the web app,
 * which is what makes the announcement impossible to forget: there is no
 * other way for the phone to write.
 */
export const announcingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok) {
    // Supabase and the web wrapper both pass a URL string and an init; a
    // Request object is read too, so a later caller cannot slip past.
    const request = typeof input === "object" && "url" in input ? input : null;
    const url = request ? request.url : String(input);
    const method = init?.method ?? request?.method ?? "GET";
    const areas = areasWrittenTo(url, method);
    if (areas && areas.length > 0) {
      notifyDataChanged(...areas);
    }
  }
  return response;
};

const versions = new Map<DataArea, number>(ALL_AREAS.map((area) => [area, 0]));
const listeners = new Set<() => void>();
const pending = new Set<DataArea>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * How long announcements are gathered before screens hear of them. A save
 * is often several writes — the skip, then the row; the row, then its
 * template's quote — and without this each would reload the screen in view
 * on its way past, the first of them onto a half-written state.
 */
const GATHER_MS = 120;

function flush(): void {
  flushTimer = null;
  for (const area of pending) {
    versions.set(area, (versions.get(area) ?? 0) + 1);
  }
  pending.clear();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Say that data in `areas` changed — every area when none is named, which is
 * what coming back to the app or a pushed notification means: something
 * changed somewhere else, and nobody here knows what.
 *
 * Writes made through `supabase` or `callWebApi` announce themselves; call
 * this only for a change those two cannot see.
 */
export function notifyDataChanged(...areas: DataArea[]): void {
  for (const area of areas.length > 0 ? areas : ALL_AREAS) {
    pending.add(area);
  }
  if (flushTimer === null) {
    flushTimer = setTimeout(flush, GATHER_MS);
  }
}

/**
 * A number that changes whenever data in one of `areas` does. Every area
 * when none is given: a screen that reads most of the ledger should not
 * have to list it, and missing an area is the bug this module exists to
 * remove.
 */
export function useDataVersion(areas: readonly DataArea[] = ALL_AREAS): number {
  // A sum, because each area's count only ever goes up: any change to any
  // of them moves it, and a number is a snapshot React can compare.
  const snapshot = () =>
    areas.reduce((sum, area) => sum + (versions.get(area) ?? 0), 0);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
