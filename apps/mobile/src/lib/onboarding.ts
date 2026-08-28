import AsyncStorage from "@react-native-async-storage/async-storage";

/** Keyed per user so a second account on the same device still gets setup. */
function storageKey(userId: string): string {
  return `onboarding.complete.${userId}`;
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(userId))) === "1";
  } catch {
    // Never block the app on a storage read; worst case setup shows again.
    return true;
  }
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), "1");
  } catch {
    // Ignored: completing setup must not fail on a storage write.
  }
}
