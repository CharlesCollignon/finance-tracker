import { Appearance } from "react-native";

/**
 * Pin the app to its one theme.
 *
 * There used to be a stored preference of light, dark or system here. There
 * is one palette now, and the scheme is still set explicitly rather than left
 * alone: NativeWind resolves `dark:` variants from it, and a phone in light
 * mode would otherwise render the light half of every variant over a dark
 * palette.
 */
export function initTheme(): void {
  Appearance.setColorScheme("dark");
}
