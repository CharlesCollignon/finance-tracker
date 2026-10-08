import { describe, expect, it } from "vitest";

import {
  buildDueNotifications,
  isGoneStatus,
  notificationsToSay,
  type PendingNotification,
} from "./push-digest";
import { translator } from "./i18n/t";

// English by default so the assertions below read as the sentences a reader
// would get; the French pass at the bottom of this file is what proves the
// language reaches the copy.
function build(options: Partial<Parameters<typeof buildDueNotifications>[0]>) {
  return buildDueNotifications({
    today: "2026-09-14",
    alreadySent: new Set(),
    t: translator("en"),
    ...options,
  });
}

describe("buildDueNotifications", () => {
  it("says nothing on an ordinary day with nothing wrong", () => {
    expect(build({})).toEqual([]);
  });

  it("announces the new month on the first", () => {
    const due = build({ today: "2026-09-01" });
    expect(due).toHaveLength(1);
    expect(due[0]!.key).toBe("month-open:2026-09");
    expect(due[0]!.url).toBe("/bearing");
  });

  it("counts the charges the month starts with when it knows them", () => {
    const due = build({ today: "2026-09-01", pendingRecurring: 8 });
    expect(due[0]!.body).toContain("starts with 8 charges");
  });

  it("uses the singular for one charge", () => {
    const due = build({ today: "2026-09-01", pendingRecurring: 1 });
    expect(due[0]!.body).toContain("starts with 1 charge.");
  });

  it("does not announce the month twice", () => {
    const due = build({
      today: "2026-09-01",
      alreadySent: new Set(["month-open:2026-09"]),
    });
    expect(due).toEqual([]);
  });
});

describe("notificationsToSay", () => {
  const push = (
    key: string,
    covers?: readonly string[],
  ): PendingNotification => ({
    kind: "dca",
    key,
    title: key,
    body: "",
    url: "/bearing",
    ...(covers ? { covers } : {}),
  });
  const keys = (pushes: readonly PendingNotification[]) =>
    pushes.map((one) => one.key);

  it("leaves out what was said already", () => {
    const { send, log } = notificationsToSay(
      [push("a"), push("b")],
      new Set(["a"]),
    );
    expect(keys(send)).toEqual(["b"]);
    expect(log).toEqual(["b"]);
  });

  it("sends one that says another due with it, and logs both", () => {
    // The salary came in on the reminder's day: one push, not two.
    const { send, log } = notificationsToSay(
      [
        push("dca-transfer-paid:2026-11", ["dca-transfer-soon:2026-11"]),
        push("dca-transfer-soon:2026-11"),
      ],
      new Set(),
    );
    expect(keys(send)).toEqual(["dca-transfer-paid:2026-11"]);
    expect(log).toEqual([
      "dca-transfer-paid:2026-11",
      "dca-transfer-soon:2026-11",
    ]);
  });

  it("still sends the other when the one that covers it went earlier", () => {
    // The salary's push went days before; the reminder is its own news.
    const { send } = notificationsToSay(
      [
        push("dca-transfer-paid:2026-11", ["dca-transfer-soon:2026-11"]),
        push("dca-transfer-soon:2026-11"),
      ],
      new Set(["dca-transfer-paid:2026-11"]),
    );
    expect(keys(send)).toEqual(["dca-transfer-soon:2026-11"]);
  });
});

describe("isGoneStatus", () => {
  it("treats the two defined gone codes as permanent", () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
  });

  it("keeps the subscription for anything transient", () => {
    expect(isGoneStatus(500)).toBe(false);
    expect(isGoneStatus(429)).toBe(false);
    expect(isGoneStatus(201)).toBe(false);
  });
});

describe("the reader's language", () => {
  const inFrench = (
    options: Partial<Parameters<typeof buildDueNotifications>[0]>,
  ) => build({ ...options, t: translator("fr") });

  it("writes the month-open nudge in French", () => {
    const [notification] = inFrench({
      today: "2026-09-01",
      pendingRecurring: 3,
    });
    expect(notification?.title).toBe("Un nouveau mois");
    expect(notification?.body).toBe(
      "Il commence avec 3 opérations récurrentes. Voyez ce qu'il reste.",
    );
  });

  it("puts one in the French singular, as English does", () => {
    const [notification] = inFrench({
      today: "2026-09-01",
      pendingRecurring: 1,
    });
    expect(notification?.body).toBe(
      "Il commence avec 1 opération récurrente. Voyez ce qu'il reste.",
    );
  });
});
