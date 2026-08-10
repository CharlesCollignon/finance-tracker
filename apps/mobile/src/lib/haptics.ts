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

export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );
  } catch {
    // ignore
  }
}

export async function hapticWarning(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    );
  } catch {
    // ignore
  }
}
