/**
 * Whether a transaction form carried its tags, and which.
 *
 * A form that never rendered the tags control posts no `tagIds`, which reads
 * exactly like "every box unticked". The edit action used to take it that
 * way and deleted every tag on the transaction — which is what editing from
 * the Calendar did, because the Calendar's form was never given the tags.
 * The marker is posted alongside the control, so its absence means "not
 * asked", never "none".
 *
 * Not in `finance.ts`: that file is `"use server"`, where every export must
 * be an async action.
 */
export const TAGS_FIELD_MARKER = "tagsField";

export function readSubmittedTagIds(formData: FormData): string[] | null {
  if (formData.get(TAGS_FIELD_MARKER) === null) {
    return null;
  }
  return formData
    .getAll("tagIds")
    .filter((value): value is string => typeof value === "string");
}
