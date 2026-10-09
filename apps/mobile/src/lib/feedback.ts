import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Linking from "expo-linking";

import type { Translate } from "@finance/core/i18n/t";

/**
 * « Envoyer un retour »: an email, already addressed, with what the reader
 * would otherwise be asked first — the app's version and the phone. Nothing
 * about their money, and they see all of it before sending.
 */
function aboutThisPhone(): string {
  const version = Constants.expoConfig?.version ?? "?";
  const phone = [Device.manufacturer, Device.modelName]
    .filter(Boolean)
    .join(" ");
  const system = [Device.osName, Device.osVersion].filter(Boolean).join(" ");
  return [`Pluclair ${version}`, system, phone].filter(Boolean).join(" · ");
}

/** Open the mail app on the message; false when there is none to open. */
export async function sendFeedback(
  t: Translate,
  email: string,
): Promise<boolean> {
  const subject = encodeURIComponent(t("profile.feedbackSubject"));
  const body = encodeURIComponent(
    t("profile.feedbackBody", { about: aboutThisPhone() }),
  );
  try {
    await Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
    return true;
  } catch {
    return false;
  }
}
