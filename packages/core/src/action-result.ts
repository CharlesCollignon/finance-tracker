/**
 * What a write reports back, on both apps.
 *
 * Either it worked — `success`, perhaps a `message` (a catalogue key or a
 * sentence already in the reader's words) and whatever the write has to say
 * (`imported`, `moved`…) — or it did not, and `error` says why, as a message
 * key wherever one exists. The fields of the first are present on the second
 * as `undefined`, so a caller can read `result.error`, `result.message` or
 * `result.imported` without narrowing first: the shape the screens already
 * read, given one name instead of the thirteen local `ActionResult`s it had.
 */
export type ActionResult<T extends object = object> =
  | ({ success: true; error?: undefined; message?: string } & T)
  | ({ success?: false; error: string; message?: undefined } & {
      [K in keyof T]?: undefined;
    });

/** The first problem a failed zod parse found, as the message to show. */
export function firstIssue(error: {
  issues: readonly { message: string }[];
}): string {
  return error.issues[0]?.message ?? "errors.invalidInput";
}

/**
 * A form's state before its first submission, for `useActionState`: nothing
 * has worked and nothing has failed. A form action takes this as its previous
 * state, so `useActionState(action, {})` starts somewhere honest instead of
 * pretending an empty object is a result.
 */
export type FormState<T extends object = object> =
  | ActionResult<T>
  | { success?: undefined; error?: undefined; message?: undefined };
