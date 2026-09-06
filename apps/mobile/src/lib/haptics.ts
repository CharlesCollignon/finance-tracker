import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Light tap feedback for primary actions. No-ops on web. */
export async function hapticLight(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics unavailable on some devices/simulators.
  }
}

/**
 * The tick for changing a selection — a segment, a range, a crossed data
 * point. Quieter than `hapticLight`, because it fires often and a full impact
 * on every step of a scrub is a buzzing phone rather than feedback.
 */
export async function hapticSelection(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    await Haptics.selectionAsync();
  } catch {
    // Haptics unavailable on some devices/simulators.
  }
}

/** The weight for the app's primary action, one step up from light. */
export async function hapticMedium(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // ignore
  }
}

export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // ignore
  }
}

export async function hapticWarning(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // ignore
  }
}
