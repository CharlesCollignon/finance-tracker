import { Platform } from "react-native";
import { NativeModule, requireOptionalNativeModule } from "expo";

/**
 * The home-screen quick actions on iOS, as their `pluclair://` address
 * (`plugins/with-quick-actions.js`). Android's open their address directly,
 * so there is nothing to take there; nor in a build without the module, such
 * as Expo Go.
 */
declare class QuickActionsModule extends NativeModule<{
  onQuickAction: (event: { href: string }) => void;
}> {
  takePending(): string | null;
}

const native =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<QuickActionsModule>("PluclairQuickActions")
    : null;

/** The action that opened the app, once. */
export function takePendingQuickAction(): string | null {
  return native?.takePending() ?? null;
}

/** Every action pressed while the app is running. */
export function addQuickActionListener(
  listener: (href: string) => void,
): { remove: () => void } | null {
  return (
    native?.addListener("onQuickAction", (event) => listener(event.href)) ??
    null
  );
}
