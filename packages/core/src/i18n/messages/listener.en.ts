/**
 * « Notifications de votre banque » (Android): the bank apps' notifications
 * read on the phone as provisional lines (`docs/plans/STATEMENTS_PLAN.md`,
 * Phase 5). `en.ts` mounts it as `listener`.
 */
export const listenerEn = {
  title: "Your bank's notifications",
  intro:
    "With Android's “Notification access”, Pluclair reads, on this phone only, the notifications of the bank apps you pick — “Payment of €12.30 at MONOP'” — and each becomes a line to check the moment it shows. Nothing else is read, and nothing leaves the phone but the lines.",
  invite: "Each payment your bank announces, as a line to check, on its own.",
  open: "Set it up",
  /** The build. */
  notHere: "This phone cannot read notifications",
  notHereBody:
    "Android only, and only in a build of Pluclair that carries the listener.",
  /** The access. */
  accessTitle: "Notification access",
  accessOn: "Granted: Pluclair reads the apps picked below.",
  accessOff: "Not granted yet. Android asks for it on its own page.",
  openSettings: "Open the Android settings",
  /** The apps. */
  appsTitle: "Bank apps to read",
  appsNone:
    "No known bank app is installed on this phone. Pluclair knows the apps of the French banks it reads statements from.",
  appsHint: "Only the apps ticked are read.",
  /** The account. */
  accountTitle: "Their lines go to",
  accountNone:
    "Import one statement first, so Pluclair knows the account to put the lines on.",
  /** Reading. */
  readNow: "Read what is waiting",
  reading: "Reading…",
  waiting: {
    one: "{count} notification waiting",
    other: "{count} notifications waiting",
  },
  read: {
    one: "{count} line brought to check",
    other: "{count} lines brought to check",
  },
  readNone: "Nothing new to bring",
  skipped: {
    one: "{count} notification said no operation",
    other: "{count} notifications said no operation",
  },
  lastRead: "Last read {date}",
  broughtSoFar: {
    one: "{count} line brought so far",
    other: "{count} lines brought so far",
  },
  unverified:
    "Built on the notifications French banks are known to send, and not yet seen working on a phone: check the first lines it brings.",
};
