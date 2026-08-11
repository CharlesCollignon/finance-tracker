import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "privacy-blur";

export async function loadPrivacyHidden(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === "1";
  } catch {
    return false;
  }
}

export async function savePrivacyHidden(hidden: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
}
