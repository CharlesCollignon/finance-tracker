import type { ActionResult } from "@finance/core/action-result";
import type { AddressMatch } from "@finance/core/address-search";
import * as properties from "@finance/data/properties";

import { supabase } from "@/lib/supabase";
import { callWebApi, webApiAvailable } from "@/lib/web-api";

/**
 * A user's properties and their loans (migration 049). The reads and writes
 * are `@finance/data/properties`, the same as the web's, so a loan's payment
 * is written, and a property's figures read, one way on both apps. These
 * wrappers hand them the phone's client and the signed-in user.
 */

export type AttachedTemplate = properties.AttachedTemplate;
export type PropertyChange = properties.PropertyChange;
export type LoanChange = properties.LoanChange;

async function requireUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function asUser<T extends object>(
  work: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" } as ActionResult<T>;
  }
  return work(userId);
}

/* ------------------------------------------------------------------ reading */

export function getProperties(
  userId: string,
): Promise<properties.PropertiesState> {
  return properties.getProperties(supabase, userId);
}

export function getPropertyNames(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return properties.getPropertyNames(supabase, userId);
}

/**
 * Addresses for what has been typed, asked of the geocoder through the web
 * server, as the web's own form does, so IGN never learns who asked. Nothing
 * when there is no web app to ask: the property is then kept without a
 * position.
 */
export async function findAddresses(query: string): Promise<AddressMatch[]> {
  if (!webApiAvailable()) {
    return [];
  }
  const result = await callWebApi<{ matches: AddressMatch[] }>(
    `/api/property/addresses?q=${encodeURIComponent(query)}`,
    { method: "GET", timeoutMs: 8_000 },
  );
  return result.ok ? result.matches : [];
}

/* ------------------------------------------------------------------ writing */

export function addPropertyWithLoan(input: {
  property: PropertyChange;
  loan: Omit<LoanChange, "propertyId"> | null;
  payment: { categoryName: string } | null;
}) {
  return asUser((userId) =>
    properties.addPropertyWithLoan(supabase, userId, input),
  );
}

export function updateProperty(input: PropertyChange) {
  return asUser((userId) => properties.saveProperty(supabase, userId, input));
}

export function setOwnValue(propertyId: string, value: number | null) {
  return asUser((userId) =>
    properties.setPropertyValue(supabase, userId, propertyId, value),
  );
}

/** How much a year a property is expected to gain, for the long view. */
export function setGrowth(propertyId: string, growth: number | null) {
  return asUser((userId) =>
    properties.setPropertyGrowth(supabase, userId, propertyId, growth),
  );
}

export function removeProperty(propertyId: string) {
  return asUser((userId) =>
    properties.deleteProperty(supabase, userId, propertyId),
  );
}

export function saveLoan(
  input: LoanChange,
  payment: { categoryName: string; description: string } | null,
) {
  return asUser((userId) =>
    properties.saveLoan(
      supabase,
      userId,
      input,
      payment ? { addPayment: payment } : {},
    ),
  );
}

export function addLoanPayment(
  loanId: string,
  payment: { categoryName: string; description: string },
) {
  return asUser((userId) =>
    properties.addLoanPayment(supabase, userId, loanId, payment),
  );
}

export function setKnownOutstanding(
  loanId: string,
  known: { outstanding: number; on: string; keeps: "payment" | "term" } | null,
) {
  return asUser((userId) =>
    properties.setLoanKnownOutstanding(supabase, userId, loanId, known),
  );
}

export function syncLoanPayment(loanId: string) {
  return asUser((userId) =>
    properties.syncLoanPayment(supabase, userId, loanId),
  );
}

export function removeLoan(loanId: string) {
  return asUser((userId) => properties.deleteLoan(supabase, userId, loanId));
}

/**
 * Ask the web server what the market says about a property — the DVF files
 * are megabytes the phone has no business downloading. Not awaited by the
 * sheets: the answer, when it comes, reloads the screens that read
 * properties, through the route's data area.
 */
export async function requestMarketReading(propertyId: string): Promise<void> {
  if (!webApiAvailable()) {
    return;
  }
  await callWebApi<{ status: string }>("/api/property/market", {
    body: { propertyId },
    timeoutMs: 65_000,
  });
}
