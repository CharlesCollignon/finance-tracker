import {
  SECTOR_IDS,
  instrumentReadingJsonSchema,
  type InstrumentReadingRequest,
  type InstrumentReadingSource,
} from "@finance/core/instrument-reading";
import { monthReadModel } from "@/lib/month-read/client";

/**
 * Reading one instrument off the market.
 *
 * Two calls to two different endpoints, and the split is forced rather than
 * chosen. Web search is a built-in connector on Mistral's Conversations API
 * and is **not available on chat/completions**; a strict `response_format` is
 * what chat/completions is for. So the first call searches and writes notes,
 * and the second transcribes those notes into the shape the verifier expects.
 *
 * The second call is cheap — a few hundred tokens over text already in hand —
 * and buys a reading that either satisfies the schema or is `null`, with no
 * middle state to reason about. It also means the structured half runs on the
 * same proven path as the month read.
 *
 * Same key and model as every other model call in this app. Nothing new to
 * configure: if the month read works, this works.
 *
 * ## What can go wrong, and what happens
 *
 * `web_search` may not be entitled on a given plan, which comes back as a
 * 4xx. That is caught, recorded as a failure, and returned as `null` — which
 * the caller refunds, because nothing was spent. The look-through then simply
 * reports those instruments as unread, which is its ordinary state and is
 * rendered honestly rather than as zeroes.
 */

const CONVERSATIONS_ENDPOINT = "https://api.mistral.ai/v1/conversations";
const COMPLETIONS_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

/** Facts, not prose: as close to deterministic as the parameter allows. */
const TEMPERATURE = 0;

const SEARCH_MAX_TOKENS = 4000;
const TRANSCRIBE_MAX_TOKENS = 2000;

/**
 * Generous, because a search-backed turn is slow and variable.
 *
 * The route that calls this runs under a sixty-second ceiling and reads one
 * instrument per request. Coming back at forty leaves room to store the
 * reading, or to refund the attempt and answer the client properly, rather
 * than being killed mid-flight with the reservation already spent.
 */
const SEARCH_TIMEOUT_MS = 40_000;
const TRANSCRIBE_TIMEOUT_MS = 20_000;

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

function apiKey(): string | null {
  return process.env.MISTRAL_API_KEY?.trim() || null;
}

export function instrumentReadingModel(): string {
  return monthReadModel();
}

/** A boolean, so the key never crosses into anything that renders. */
export function instrumentReadingConfigured(): boolean {
  return apiKey() !== null;
}

const SEARCH_INSTRUCTIONS =
  "You look up published facts about one exchange-traded fund and report what " +
  "the issuer's own documents say. Search for the fund's factsheet or KID by " +
  "its ISIN. Prefer the issuer's own site, then a fund-data site such as " +
  "justETF or Morningstar.\n\n" +
  "Report only figures you actually found on a page, and say plainly when " +
  "something could not be found — a missing ongoing charge is an ordinary " +
  "answer and a guessed one is worse than none. Give the ISIN exactly as the " +
  "page states it, and say so if it differs from the one asked about. Offer " +
  "no opinion about the fund.";

const TRANSCRIBE_INSTRUCTIONS =
  "You turn notes about a fund into structured data. Copy only what the notes " +
  "state. Where the notes do not give a figure, use null — never estimate, " +
  "and never fill a gap from your own knowledge of the fund.\n\n" +
  `Sector weights use exactly these ids: ${SECTOR_IDS.join(", ")}. Country ` +
  "weights are ISO 3166-1 alpha-2 codes. Every weight is a fraction between " +
  "0 and 1, not a percentage: 25% is 0.25. An ongoing charge of 0.20% is " +
  "0.002.";

export interface InstrumentReadingSourceOptions {
  /** The two network calls, injected so failure handling is testable. */
  search?: (request: InstrumentReadingRequest, key: string) => Promise<string>;
  transcribe?: (
    request: InstrumentReadingRequest,
    notes: string,
    key: string,
  ) => Promise<unknown>;
  now?: () => number;
  failureThreshold?: number;
  cooldownMs?: number;
}

async function post(
  endpoint: string,
  body: unknown,
  key: string,
  timeoutMs: number,
  label: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // The status, never the body. A 401 or 403 here most likely means the
      // plan does not include the web search connector, which is worth being
      // able to tell apart from the provider being down.
      throw new Error(`Mistral ${label} answered ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Everything the assistant said, with its citations appended.
 *
 * A `message.output` entry's content is either a plain string or a list of
 * chunks that alternate between text and `tool_reference`. The references are
 * the pages the figures came from, and they are folded into the notes so the
 * transcribing call can put them in `sources` — which is what lets a figure
 * on screen be traced back to where it was read.
 */
function notesFromConversation(raw: unknown): string {
  const outputs =
    (raw as { outputs?: { type?: string; content?: unknown }[] })?.outputs ?? [];

  const text: string[] = [];
  const sources: string[] = [];

  for (const entry of outputs) {
    if (entry?.type !== "message.output") {
      continue;
    }
    const content = entry.content;

    if (typeof content === "string") {
      text.push(content);
      continue;
    }

    if (!Array.isArray(content)) {
      continue;
    }

    for (const chunk of content) {
      const kind = (chunk as { type?: string })?.type;
      if (kind === "text") {
        const value = (chunk as { text?: unknown }).text;
        if (typeof value === "string") {
          text.push(value);
        }
      } else if (kind === "tool_reference") {
        const url = (chunk as { url?: unknown }).url;
        if (typeof url === "string" && !sources.includes(url)) {
          sources.push(url);
        }
      }
    }
  }

  const notes = text.join("").trim();
  if (notes === "" || sources.length === 0) {
    return notes;
  }

  return `${notes}\n\nPages read:\n${sources.map((url) => `- ${url}`).join("\n")}`;
}

async function defaultSearch(
  request: InstrumentReadingRequest,
  key: string,
): Promise<string> {
  const named = request.symbol
    ? `${request.name} (${request.symbol}), ISIN ${request.isin}`
    : `${request.name}, ISIN ${request.isin}`;

  const raw = await post(
    CONVERSATIONS_ENDPOINT,
    {
      model: instrumentReadingModel(),
      // Inline rather than against a stored agent: an agent would be a second
      // thing to create, version and keep in step with this prompt.
      instructions: SEARCH_INSTRUCTIONS,
      tools: [{ type: "web_search" }],
      completion_args: {
        temperature: TEMPERATURE,
        max_tokens: SEARCH_MAX_TOKENS,
      },
      // Nothing to come back to: each reading is one question, and a stored
      // conversation would leave this person's holdings sitting on a third
      // party's servers for no purpose.
      store: false,
      inputs: [
        {
          role: "user",
          content:
            `Find, for ${named}:\n` +
            "- the annual ongoing charge (TER or OCF)\n" +
            "- the fund's currency\n" +
            "- its country breakdown by weight\n" +
            // Asked for in full and by name, because a partial answer is
            // what actually came back: a first live run returned three of
            // eleven sectors. The reader downstream reports the shortfall
            // rather than hiding it, but a complete list is better than a
            // caveat about an incomplete one.
            "- its sector breakdown by weight, every sector the factsheet " +
            "lists, not just the largest few\n" +
            "- its largest holdings with weights\n\n" +
            "Give the figures and say which page each came from.",
        },
      ],
    },
    key,
    SEARCH_TIMEOUT_MS,
    "conversations",
  );

  return notesFromConversation(raw);
}

async function defaultTranscribe(
  request: InstrumentReadingRequest,
  notes: string,
  key: string,
): Promise<unknown> {
  const raw = await post(
    COMPLETIONS_ENDPOINT,
    {
      model: instrumentReadingModel(),
      temperature: TEMPERATURE,
      max_tokens: TRANSCRIBE_MAX_TOKENS,
      response_format: instrumentReadingJsonSchema(),
      messages: [
        { role: "system", content: TRANSCRIBE_INSTRUCTIONS },
        {
          role: "user",
          content:
            `The instrument asked about was ISIN ${request.isin}.\n\nNotes:\n${notes}`,
        },
      ],
    },
    key,
    TRANSCRIBE_TIMEOUT_MS,
    "completions",
  );

  const content = (
    raw as { choices?: { message?: { content?: unknown } }[] }
  )?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function createMistralInstrumentReadingSource(
  options: InstrumentReadingSourceOptions = {},
): InstrumentReadingSource {
  const search = options.search ?? defaultSearch;
  const transcribe = options.transcribe ?? defaultTranscribe;
  const now = options.now ?? Date.now;
  const failureThreshold = options.failureThreshold ?? FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? COOLDOWN_MS;

  let consecutiveFailures = 0;
  let cooldownUntil = 0;

  return {
    get model() {
      return instrumentReadingModel();
    },

    async read(request: InstrumentReadingRequest) {
      const key = apiKey();
      if (!key) {
        return null;
      }
      if (now() < cooldownUntil) {
        return null;
      }

      try {
        const notes = await search(request, key);

        // A search that found nothing is not a failure of the provider, and
        // must not count towards the breaker — otherwise three obscure funds
        // in a row would put the whole feature to sleep.
        if (notes.trim() === "") {
          consecutiveFailures = 0;
          return null;
        }

        const answer = await transcribe(request, notes, key);
        consecutiveFailures = 0;
        cooldownUntil = 0;
        return answer;
      } catch (error) {
        console.warn(
          `[instrument-reading] no answer from ${instrumentReadingModel()}: ${
            error instanceof Error ? error.message : "unknown failure"
          }`,
        );
        consecutiveFailures += 1;
        if (consecutiveFailures >= failureThreshold) {
          cooldownUntil = now() + cooldownMs;
        }
        return null;
      }
    },
  };
}
