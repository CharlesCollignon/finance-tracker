import { NativeModules, TurboModuleRegistry } from "react-native";

/**
 * Whether this build carries the widget's native code — not Expo Go, nor a
 * build made before the widget. `react-native-android-widget` throws as soon
 * as it is loaded without it, so the files that import it are only required
 * once this is known (`register.android.ts`, `update.android.ts`).
 */
export const hasWidget: boolean =
  TurboModuleRegistry.get("AndroidWidget") != null ||
  NativeModules.AndroidWidget != null;
