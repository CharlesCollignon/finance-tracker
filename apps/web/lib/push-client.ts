"use client";

import {
  deletePushSubscription,
  savePushSubscription,
} from "@/lib/actions/push";

/**
 * Turning browser notifications on and off.
 *
 * Every step is a place this can legitimately not work — no service worker, no
 * Push API, permission denied, or an iOS browser that only supports push once
 * the app is installed to the home screen. Each returns a reason rather than
 * throwing, because the UI has to explain the situation, not just fail.
 */

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: string };

export function checkPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Not available here." };
  }
  if (!("serviceWorker" in navigator)) {
    return {
      supported: false,
      reason: "This browser cannot run background workers.",
    };
  }
  if (!("PushManager" in window)) {
    // Safari on iOS reports this until the app is added to the home screen.
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return {
      supported: false,
      reason: iOS
        ? "On iPhone and iPad, add Pluclair to your home screen first — Safari only allows notifications for installed apps."
        : "This browser does not support notifications.",
    };
  }
  return { supported: true };
}

/**
 * VAPID keys travel as base64url; the Push API wants raw bytes.
 *
 * Backed by an explicit ArrayBuffer because `applicationServerKey` will not
 * accept a view over a possibly-shared buffer.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    view[i] = raw.charCodeAt(i);
  }
  return buffer;
}

function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) {
    return "";
  }
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!checkPushSupport().supported) {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(
  publicKey: string,
): Promise<{ error?: string; success?: boolean }> {
  const support = checkPushSupport();
  if (!support.supported) {
    return { error: support.reason };
  }
  if (!publicKey) {
    return { error: "Notifications are not configured on this server." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      error:
        permission === "denied"
          ? "Notifications are blocked for this site in your browser settings."
          : "Notifications were not allowed.",
    };
  }

  // `ready` rather than `getRegistration`, so this works on the very first
  // visit where the worker is still activating.
  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push must be visible to the user.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      });
    } catch {
      return { error: "This browser refused the notification subscription." };
    }
  }

  const json = subscription.toJSON();
  const result = await savePushSubscription({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? keyToBase64(subscription.getKey("p256dh")),
    auth: json.keys?.auth ?? keyToBase64(subscription.getKey("auth")),
    userAgent: navigator.userAgent.slice(0, 400),
  });

  if (result.error) {
    return { error: result.error };
  }
  return { success: true };
}

export async function disablePush(): Promise<{ error?: string }> {
  const subscription = await currentSubscription();
  if (!subscription) {
    return {};
  }

  const { endpoint } = subscription;
  // Told the server first: a browser that unsubscribes locally but stays in
  // the table means sends that fail forever.
  const result = await deletePushSubscription(endpoint);
  await subscription.unsubscribe().catch(() => undefined);

  return result.error ? { error: result.error } : {};
}
