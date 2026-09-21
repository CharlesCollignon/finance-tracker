/**
 * Naming the model that wrote a read.
 *
 * Every piece of prose in this app — a month read, a category read, a wallet
 * read — is written by a model, and the app used to say so with the word
 * "a model". That is true and useless: it tells a reader that a machine was
 * involved without telling them which one, so somebody deciding how much
 * weight to give a sentence has nothing to weigh it against.
 *
 * Two lengths, because two places need different ones. A button has room for
 * the maker and nothing else — "Review with Mistral" — while the small print
 * under a stored read has room to be exact, and exact is what makes the
 * disclosure worth making: the model that wrote a read six weeks ago may not
 * be the one configured today.
 *
 * Derived from the configured id rather than looked up in a table. The model
 * is set by `MISTRAL_MODEL` and changes without a deploy, so a table would be
 * a list of names that silently goes out of date — and the failure mode of a
 * stale table here is the app naming the wrong model, which is worse than
 * naming an unfamiliar one.
 */

/**
 * The model used when nothing is configured.
 *
 * Here rather than beside the web client that reads `MISTRAL_MODEL`, because
 * the phone needs it too and cannot read that environment: it posts to the
 * web app for a write, so it knows a writer exists without knowing which. The
 * maker is the same either way — the key is `MISTRAL_API_KEY` and the
 * endpoint is Mistral's, so a deployment can change the model's size and
 * never its maker — which is what lets a button on a phone name the writer
 * honestly without a round trip.
 */
export const DEFAULT_WRITER_MODEL = "mistral-medium-latest";

/** The makers this app knows how to name, and how they spell themselves. */
const BRANDS: Record<string, string> = {
  mistral: "Mistral",
};

export interface ModelName {
  /** The maker alone, for a control with no room for more. */
  brand: string;
  /** Maker and model, for the line that says who wrote this. */
  full: string;
  /** Exactly what is configured, for the line that has to be checkable. */
  id: string;
}

/** "large" → "Large"; a build tag like "2505" is left as it is. */
function titleCase(segment: string): string {
  if (segment === "") {
    return segment;
  }
  return segment[0].toUpperCase() + segment.slice(1);
}

/**
 * What to call the model this deployment is configured with.
 *
 * An id whose first segment names no maker this app knows is handed back
 * unchanged, in all three fields. Saying "Mistral" over a model that is not
 * Mistral's would be the one failure this function must not have — the whole
 * point of naming the writer is that the name is true.
 */
export function describeModel(modelId: string): ModelName {
  const id = modelId.trim();
  if (id === "") {
    return { brand: "", full: "", id: "" };
  }

  const [maker, ...rest] = id.split("-");
  const brand = BRANDS[maker.toLowerCase()];

  if (brand === undefined) {
    return { brand: id, full: id, id };
  }

  // "latest" is a pointer rather than a name: a reader gains nothing from
  // "Mistral Large Latest", and the exact id is carried separately anyway for
  // anyone who wants to know which build answered.
  const parts = rest
    .filter((part) => part !== "" && part !== "latest")
    .map(titleCase);

  return { brand, full: [brand, ...parts].join(" "), id };
}
