import { Platform } from "react-native";
import { NativeModule, requireOptionalNativeModule } from "expo";

/**
 * The bank apps' notifications, kept by the phone's own listener
 * (`android/`, Android only; docs/plans/STATEMENTS_PLAN.md Phase 5) until
 * the app reads them. Nothing in a build without the module — Expo Go, an
 * iPhone — where every call answers as if nothing were there.
 */

export interface KeptNotification {
  packageName: string;
  title: string;
  text: string;
  /** Milliseconds since the epoch. */
  postedAt: number;
}

declare class ListenerModule extends NativeModule {
  isEnabled(): boolean;
  openSettings(): void;
  getPackages(): string[];
  setPackages(packages: string[]): void;
  installed(candidates: string[]): string[];
  count(): number;
  take(): KeptNotification[];
}

const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<ListenerModule>("PluclairNotificationListener")
    : null;

/** This build carries the listener. */
export const listenerAvailable = native !== null;

/** « Accès aux notifications » granted to Pluclair. */
export function listenerEnabled(): boolean {
  return native?.isEnabled() ?? false;
}

/** Android's page where the access is granted. */
export function openListenerSettings(): void {
  native?.openSettings();
}

/** The bank apps whose notifications are kept. */
export function listenedPackages(): string[] {
  return native?.getPackages() ?? [];
}

export function setListenedPackages(packages: string[]): void {
  native?.setPackages(packages);
}

/** Which of these apps are on the phone. */
export function installedPackages(candidates: string[]): string[] {
  return native?.installed(candidates) ?? [];
}

/** How many notifications wait to be read. */
export function waitingCount(): number {
  return native?.count() ?? 0;
}

/** Everything waiting, read once. */
export function takeNotifications(): KeptNotification[] {
  return native?.take() ?? [];
}
