import type { ActionResult } from "@finance/core/action-result";
import { DEFAULT_CATEGORIES } from "@finance/core/constants";
import { isCryptoCategoryName } from "@finance/core/crypto-holdings";
import {
  TRANSFER_INVITATION_PROMPT,
  transferInvitation,
  type TransferInvitation,
} from "@finance/core/dca-need";
import type { Locale } from "@finance/core/i18n/locale";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { recurringTemplateSchema } from "@finance/core/validations/finance";

import type { Db } from "./client";
import { readFollowFacts } from "./dca-transfer";
import { dbError } from "./errors";
import { dismissPrompt, readDismissedPrompts } from "./preferences";
import { saveRecurringTemplate } from "./recurring-templates";

/**
 * The offer to let a transfer follow the DCAs (`transferInvitation`), on Le
 * point: reading it, saying yes, and putting it away for good.
 */

/** What to offer, unless it was put away on any device. */
export async function getTransferInvitation(
  db: Db,
  userId: string,
  today: string,
): Promise<TransferInvitation | null> {
  try {
    const dismissed = await readDismissedPrompts(db, userId);
    return dismissed.includes(TRANSFER_INVITATION_PROMPT)
      ? null
      : await invitationFor(db, userId, today);
  } catch {
    // An offer missed today is better than a Le point that fails.
    return null;
  }
}

/**
 * Yes: their transfer to the broker now follows the DCAs, or one is created
 * on the salary's day to do so. Saved the way the charge sheet saves, so the
 * figure is worked out and the rules hold.
 */
export async function acceptTransferInvitation(
  db: Db,
  userId: string,
  today: string,
  locale: Locale,
): Promise<ActionResult> {
  const templates = await readTemplates(db, userId);
  const invitation = await invitationFor(db, userId, today, templates);
  if (!invitation) {
    return { error: "errors.invalidInput" };
  }

  let input: unknown;
  if (invitation.kind === "follow") {
    const transfer = templates.find(
      (template) => template.id === invitation.templateId,
    )!;
    input = {
      id: transfer.id,
      categoryId: transfer.category_id,
      recurrence: "monthly",
      dayOfMonth: transfer.day_of_month,
      description: transfer.description ?? undefined,
      startsOn: transfer.starts_on ?? undefined,
      endsOn: transfer.ends_on ?? undefined,
      active: true,
      pricingType: "purchases",
      // The figure it had, should next month hold no DCA after all.
      amount: Number(transfer.amount),
    };
  } else {
    const categoryId = await brokerCategory(db, userId, locale);
    if ("error" in categoryId) {
      return categoryId;
    }
    input = {
      categoryId: categoryId.id,
      recurrence: "monthly",
      dayOfMonth: invitation.dayOfMonth,
      active: true,
      pricingType: "purchases",
    };
  }

  const parsed = recurringTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }
  const saved = await saveRecurringTemplate(db, userId, parsed.data);
  return "error" in saved
    ? { error: saved.error }
    : { success: true, message: "dcaInvite.done" };
}

/** No thanks, on every device. */
export function dismissTransferInvitation(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<ActionResult> {
  return dismissPrompt(db, userId, TRANSFER_INVITATION_PROMPT, locale);
}

/**
 * The offer as `transferInvitation` makes it, with what the month it would
 * cover depends on: the transfer's confirmed, written and skipped days.
 */
async function invitationFor(
  db: Db,
  userId: string,
  today: string,
  templates?: RecurringTemplateWithCategory[],
): Promise<TransferInvitation | null> {
  const all = templates ?? (await readTemplates(db, userId));
  const facts = await readFollowFacts(
    db,
    userId,
    today,
    all,
    all.map((template) => template.id),
  );
  if ("error" in facts) {
    throw new Error(facts.error);
  }
  return transferInvitation({
    templates: all,
    today,
    debited: facts.debited,
    settledKeys: facts.settledKeys,
    skippedKeys: facts.skippedKeys,
  });
}

async function readTemplates(
  db: Db,
  userId: string,
): Promise<RecurringTemplateWithCategory[]> {
  const { data, error } = await db
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) {
    throw error;
  }
  return (data ?? []) as RecurringTemplateWithCategory[];
}

/**
 * Where a new transfer to the broker goes: the default « Virement vers le
 * courtier » under either of its names, else any investment category the
 * account pays that is not crypto's, else the default, made now.
 */
async function brokerCategory(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<{ id: string } | { error: string }> {
  const broker = DEFAULT_CATEGORIES.find(
    (category) =>
      category.type === "investment" &&
      "countsTowardSummary" in category &&
      category.countsTowardSummary === true,
  )!;
  const { data: categories, error } = await db
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("type", "investment")
    .eq("counts_toward_summary", true);
  if (error) {
    return { error: dbError(error) };
  }
  const names = new Set(
    [broker.names.fr, broker.names.en].map((name) => name.toLowerCase()),
  );
  const found =
    (categories ?? []).find((category) =>
      names.has(category.name.trim().toLowerCase()),
    ) ??
    (categories ?? []).find((category) => !isCryptoCategoryName(category.name));
  if (found) {
    return { id: found.id };
  }

  const { data: created, error: createError } = await db
    .from("categories")
    .insert({
      user_id: userId,
      name: broker.names[locale],
      type: "investment",
      icon: broker.icon,
      counts_toward_summary: true,
    })
    .select("id")
    .single();
  return createError || !created
    ? { error: createError ? dbError(createError) : "errors.invalidInput" }
    : { id: created.id };
}
