import { useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import {
  isNewerVersion,
  unseenEntries,
  type ChangelogEntry,
  type NouveautesFeed,
} from "@finance/core/changelog";
import { CHANGELOG, ROADMAP } from "@finance/core/changelog-entries";
import { todayIsoLocal } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import * as preferences from "@finance/data/preferences";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * « Nouveautés » on the phone: the list, what this account has not seen,
 * the first launch after an update, and a newer APK to download.
 *
 * The list is the web's (`/nouveautes/feed.json`) once it has answered, so
 * an APK installed long ago still hears of what shipped after it was built;
 * until then, and without a web app to ask, the one built into this APK.
 * What was seen is the account's (`user_preferences.changelog_seen`), shared
 * with the web: reading the list on one clears the dot on the other.
 *
 * One store for the whole app, so the account menu's dot, the screen and the
 * sheet after an update agree, and the feed is fetched once.
 */

/** This APK's version, as `app.json` had it when it was built. */
export const INSTALLED_VERSION = Constants.expoConfig?.version ?? "0.0.0";

interface NouveautesState {
  feed: NouveautesFeed;
  seenId: string | null;
  /** Whether the account's marker has been read, so no dot flashes first. */
  seenLoaded: boolean;
}

let state: NouveautesState = {
  feed: { entries: [...CHANGELOG], roadmap: [...ROADMAP], apk: null },
  seenId: null,
  seenLoaded: false,
};
const listeners = new Set<() => void>();

function update(change: Partial<NouveautesState>): void {
  state = { ...state, ...change };
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

/** Enough of a feed to draw: entries with ids, days and both languages. */
function isFeed(value: unknown): value is NouveautesFeed {
  const feed = value as Partial<NouveautesFeed> | null;
  return (
    Array.isArray(feed?.entries) &&
    Array.isArray(feed?.roadmap) &&
    feed.entries.every(
      (entry: Partial<ChangelogEntry>) =>
        typeof entry.id === "string" &&
        typeof entry.date === "string" &&
        typeof entry.fr?.title === "string" &&
        typeof entry.en?.title === "string",
    )
  );
}

let feedLoad: Promise<void> | null = null;

function loadFeed(): Promise<void> {
  if (!WEB_APP_URL) {
    return Promise.resolve();
  }
  feedLoad ??= fetch(`${WEB_APP_URL}/nouveautes/feed.json`)
    .then((response) => (response.ok ? response.json() : null))
    .then((json: unknown) => {
      if (isFeed(json)) {
        update({ feed: json });
      }
    })
    // Offline, or a web app behind this APK: the built-in list stands.
    .catch(() => undefined);
  return feedLoad;
}

let seenFor: string | null = null;

function loadSeen(userId: string): void {
  if (seenFor === userId) {
    return;
  }
  seenFor = userId;
  // Left unloaded where the account cannot hold a marker (before migration
  // 069, or offline): no dot rather than one that would never go.
  preferences
    .readChangelogSeen(supabase, userId)
    .then((seenId) => {
      if (seenId !== undefined) {
        update({ seenId, seenLoaded: true });
      }
    })
    .catch(() => {
      seenFor = null;
    });
}

/**
 * The list, and what in it is new for `userId` — nothing until the marker
 * has been read, so the dot never appears and then goes.
 */
export function useNouveautes(userId: string | null) {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    void loadFeed();
  }, []);
  useEffect(() => {
    if (userId) {
      loadSeen(userId);
    }
  }, [userId]);
  const unseen = current.seenLoaded
    ? unseenEntries(current.feed.entries, current.seenId, todayIsoLocal())
    : [];
  return { feed: current.feed, unseen, loaded: current.seenLoaded };
}

/** The list has been read: the dot goes here and on the web. */
export async function markNouveautesSeen(
  userId: string,
  locale: Locale,
): Promise<void> {
  const newest = state.feed.entries[0]?.id;
  if (!newest || state.seenId === newest) {
    return;
  }
  update({ seenId: newest });
  await preferences
    .markChangelogSeen(supabase, userId, newest, locale)
    .catch(() => undefined);
}

const LAST_VERSION_KEY = "pluclair.nouveautes.lastVersion";

/**
 * Whether this is the first launch since the APK was updated — not since
 * it was installed: a first install has nothing to catch up on. Records
 * this version either way.
 */
export async function isFirstLaunchAfterUpdate(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_VERSION_KEY);
    if (last !== INSTALLED_VERSION) {
      await AsyncStorage.setItem(LAST_VERSION_KEY, INSTALLED_VERSION);
    }
    return last !== null && isNewerVersion(INSTALLED_VERSION, last);
  } catch {
    return false;
  }
}

/** The APK the site offers, when it is newer than this one. */
export function newerApk(
  feed: NouveautesFeed,
): { version: string; url: string } | null {
  return feed.apk && isNewerVersion(feed.apk.version, INSTALLED_VERSION)
    ? feed.apk
    : null;
}

const APK_LATER_KEY = "pluclair.nouveautes.apkLater";

/** The version « Plus tard » was pressed on, so its banner stays away. */
export async function readApkLater(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(APK_LATER_KEY);
  } catch {
    return null;
  }
}

export async function setApkLater(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(APK_LATER_KEY, version);
  } catch {
    // Refused: the banner comes back next time, which is all that is lost.
  }
}
