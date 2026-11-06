import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import { Directory, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { isNewerVersion } from "@finance/core/changelog";
import { DEFAULT_LOCALE } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

import { WEB_APP_URL } from "@/lib/env";
import { loadLocale } from "@/lib/locale";
import { INSTALLED_VERSION } from "@/lib/nouveautes";

/**
 * A newer APK, fetched and installed from inside the app (Android only — an
 * iPhone has no APK).
 *
 * The APK comes from the site, not a store, so two things a store would do
 * are done here:
 *
 * - **Saying so.** A background check (`expo-background-task`, which Android
 *   runs through WorkManager at most every few hours, at a time it picks)
 *   reads `/nouveautes/feed.json` and, the first time it sees a version newer
 *   than this one, posts a notification on a channel of its own. Opened, the
 *   app is on Le point with the update already downloading
 *   (`NewVersionBanner`). The banner says the same thing whenever the app is
 *   opened, so the notification is only for the days it is not.
 * - **Installing.** The file is downloaded into the cache with its progress,
 *   then handed to Android's installer. Android always asks the reader to
 *   confirm an update from outside a store — and, the first time, to allow
 *   Pluclair to install apps (`REQUEST_INSTALL_PACKAGES`) — so the last tap
 *   is always theirs. The new APK replaces this one with every byte of data
 *   kept, because every build is signed with the same key.
 */

export const APK_UPDATE_TASK = "pluclair.apk-update-check";
const CHANNEL_ID = "updates";
/** The version a notification has already been posted for, so it is posted once. */
const NOTIFIED_KEY = "pluclair.apkUpdate.notified";

/** What the site hands out, if it is newer than this APK. */
export async function fetchNewerApk(): Promise<{
  version: string;
  url: string;
} | null> {
  if (!WEB_APP_URL) {
    return null;
  }
  const response = await fetch(`${WEB_APP_URL}/nouveautes/feed.json`);
  if (!response.ok) {
    return null;
  }
  const feed = (await response.json()) as {
    apk?: { version?: unknown; url?: unknown } | null;
  };
  const apk = feed.apk;
  if (
    !apk ||
    typeof apk.version !== "string" ||
    typeof apk.url !== "string" ||
    !isNewerVersion(apk.version, INSTALLED_VERSION)
  ) {
    return null;
  }
  return { version: apk.version, url: apk.url };
}

/** Post « Pluclair x.y.z est disponible » once per version, if allowed to. */
async function notifyOnce(version: string): Promise<void> {
  if ((await AsyncStorage.getItem(NOTIFIED_KEY)) === version) {
    return;
  }
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    return;
  }
  const t = translator((await loadLocale()) ?? DEFAULT_LOCALE);
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: t("apkUpdate.channelName"),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t("apkUpdate.notificationTitle", { version }),
      body: t("apkUpdate.notificationBody"),
      // Opens Le point and starts the download (`notification-routing.ts`).
      data: { url: "/", apkUpdate: version },
    },
    trigger: { channelId: CHANNEL_ID },
  });
  await AsyncStorage.setItem(NOTIFIED_KEY, version);
}

// Defined at the top level, as the task manager requires: Android can wake
// the app for it with no screen open, and the definition has to exist then.
if (Platform.OS === "android") {
  TaskManager.defineTask(APK_UPDATE_TASK, async () => {
    try {
      const apk = await fetchNewerApk();
      if (apk) {
        await notifyOnce(apk.version);
      }
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/**
 * Ask Android to run the check now and then: every six hours at the
 * earliest, at a time of its choosing. Registering again is harmless.
 */
export async function registerApkUpdateCheck(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      return;
    }
    if (!(await TaskManager.isTaskRegisteredAsync(APK_UPDATE_TASK))) {
      await BackgroundTask.registerTaskAsync(APK_UPDATE_TASK, {
        minimumInterval: 6 * 60,
      });
    }
  } catch {
    // Without the check the banner still says so on the next opening.
  }
}

/* ------------------------------------------------- download and install */

/** An update asked for from a notification, for the banner to start. */
let pendingFromNotification: string | null = null;
const pendingListeners = new Set<() => void>();

export function requestApkUpdate(version: string): void {
  pendingFromNotification = version;
  for (const listener of pendingListeners) {
    listener();
  }
}

/** Take the version a notification asked for, once. */
export function takeRequestedApkUpdate(): string | null {
  const version = pendingFromNotification;
  pendingFromNotification = null;
  return version;
}

export function onApkUpdateRequested(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

/**
 * Fetch the APK into the cache, reporting its progress from 0 to 1 (or
 * `null` while the server has not said how big it is). Any older download
 * in the folder is cleared first, so the cache holds one APK at most.
 */
export async function downloadApk(
  url: string,
  version: string,
  onProgress: (fraction: number | null) => void,
): Promise<File> {
  const folder = new Directory(Paths.cache, "apk");
  if (folder.exists) {
    folder.delete();
  }
  folder.create({ intermediates: true, idempotent: true });
  const destination = new File(folder, `pluclair-${version}.apk`);
  const task = File.createDownloadTask(url, destination, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress(totalBytes > 0 ? bytesWritten / totalBytes : null);
    },
  });
  const file = await task.downloadAsync();
  if (!file) {
    throw new Error("download cancelled");
  }
  return file;
}

/** `Intent.FLAG_GRANT_READ_URI_PERMISSION`: the installer may read the file. */
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Hand the file to Android's installer, which asks the reader to confirm —
 * and, the first time, to allow Pluclair to install apps.
 */
export async function installApk(file: File): Promise<void> {
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: file.contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: "application/vnd.android.package-archive",
  });
}
