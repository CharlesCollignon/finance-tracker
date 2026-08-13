import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, type ColorSchemeName } from "react-native";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

export async function getThemePreference(): Promise<ThemePreference> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "dark";
}

export async function setThemePreference(
  preference: ThemePreference,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}

export async function applyThemePreference(
  preference: ThemePreference,
): Promise<void> {
  const scheme: ColorSchemeName =
    preference === "system" ? "unspecified" : preference;
  Appearance.setColorScheme(scheme);
}

export async function initTheme(): Promise<ThemePreference> {
  const preference = await getThemePreference();
  await applyThemePreference(preference);
  return preference;
}
