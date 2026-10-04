import type { Writer } from "./writer";

/**
 * What changes in a request with the model behind it: a reasoning model
 * (the GPT-6 family) takes no temperature, counts its thinking against
 * `max_tokens`, and is slower. Apart from `writer.ts` so the reads' adapter
 * and its tests import it without the writer's database and flags.
 */

/**
 * Room for a reasoning model's thinking, which OpenRouter counts against
 * `max_tokens`. Each read's ceiling is sized for its answer alone, which a
 * reasoning model can spend entirely on thinking, answering nothing.
 */
const REASONING_HEADROOM = 4000;

/**
 * The sampling half of a request body for this writer: the temperature
 * where the model takes one, the token ceiling with room for a reasoning
 * model's thinking, and that thinking kept short and out of the answer.
 */
export function sampling(
  writer: Writer,
  maxTokens: number,
  temperature: number | null = writer.temperature,
): Record<string, unknown> {
  if (writer.reasoning) {
    return {
      max_tokens: maxTokens + REASONING_HEADROOM,
      reasoning: { effort: "low", exclude: true },
    };
  }
  return {
    ...(writer.temperature === null || temperature === null
      ? {}
      : { temperature }),
    max_tokens: maxTokens,
  };
}

/**
 * How long to wait for this writer: longer for a reasoning model, within
 * the sixty seconds a read's route is given.
 */
export function patience(writer: Writer, timeoutMs: number): number {
  return writer.reasoning ? Math.min(timeoutMs * 2.5, 50_000) : timeoutMs;
}
