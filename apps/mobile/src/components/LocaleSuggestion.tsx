import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCALE_LABELS, type Locale } from "@finance/core/i18n/locale";
import { suggestLocale } from "@finance/core/i18n/locale-suggestion";
import { translator } from "@finance/core/i18n/t";

import { Text } from "@/components/ui/Text";
import { deviceCountry } from "@/lib/locale";
import { useLocaleContext } from "@/providers/LocaleProvider";

const ASKED_KEY = "locale.asked";

/**
 * "Lire Pluclair en français ?"
 *
 * The phone's half of the language suggestion. The rule is the shared,
 * unit-tested `suggestLocale`; the only difference from the web is where the
 * country comes from. There is no edge in front of a phone to report an IP
 * country, so this reads the device's region setting instead — the weaker
 * signal of the two, which is another reason it asks rather than switches.
 *
 * Renders nothing almost always: only when `enabled`, the region suggests a
 * language that is not the one on screen, and the question has not been put
 * before.
 *
 * **An overlay, not a row in the layout, and that is the whole point.**
 * This component has been mis-mounted three times. Mounted inside the
 * retired Month screen it was orphaned when that screen went. Mounted above
 * `<Stack>` in the root layout it reserved `insets.top` of height on every
 * launch through a wrapper. Mounted above `<Stack>` with the margin moved
 * onto its own root — the fix for that — it left a status-bar-height dead
 * band between itself and the header below, because `SafeAreaView` is a
 * native view that applies the *provider's* insets wherever it happens to
 * sit (`RNCSafeAreaView.m`: `_currentSafeAreaInsets = _providerView.
 * safeAreaInsets`), so `Screen`'s own top inset is not reduced by anything
 * above it and cannot be overridden from JS.
 *
 * So it is taken out of the layout altogether. An absolutely positioned
 * overlay cannot displace, compress or double-inset anything, on any
 * launch, whatever it renders — which is the only property that closes this
 * class of bug rather than moving it. The container is `box-none`, so
 * everything outside the card itself stays tappable.
 *
 * `enabled` is the caller's business, not this component's: see
 * `_layout.tsx` for why a signed-out reader and a reader mid-onboarding are
 * not asked.
 */
export function LocaleSuggestion({ enabled }: { enabled: boolean }) {
  const { locale, setLocale } = useLocaleContext();
  const [asked, setAsked] = useState<boolean | null>(null);
  // Read unconditionally, ahead of the early return below: hooks cannot be
  // conditional, and this one is what positions the overlay.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void AsyncStorage.getItem(ASKED_KEY)
      .then((value) => setAsked(value === "1"))
      // Unreadable storage is treated as "already asked": a banner that
      // cannot remember being dismissed would come back every launch, which
      // is worse than never appearing.
      .catch(() => setAsked(true));
  }, []);

  // Null while storage is still being read, so the banner does not appear for
  // a frame and vanish.
  const suggested =
    asked === null || !enabled
      ? null
      : suggestLocale({ current: locale, country: deviceCountry(), asked });

  if (!suggested) {
    return null;
  }

  async function answer(chosen: Locale | null) {
    setAsked(true);
    await AsyncStorage.setItem(ASKED_KEY, "1");
    if (chosen) {
      setLocale(chosen);
    }
  }

  const offer = translator(suggested);
  const current = translator(locale);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: insets.top, left: 0, right: 0 }}
    >
      <View className="mx-4 gap-3 rounded-card p-card border border-border bg-card">
        <View className="gap-1">
          <Text variant="head">{offer("locale.suggest.title")}</Text>
          <Text variant="muted">{offer("locale.suggest.body")}</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => void answer(suggested)}
            className="rounded-full bg-foreground px-4 py-2"
          >
            <Text variant="muted" className="font-medium text-background">
              {offer("locale.suggest.accept")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void answer(null)}
            className="px-2 py-2"
          >
            <Text variant="muted" className="underline">
              {current("locale.suggest.dismiss")}
            </Text>
          </Pressable>
        </View>
        {/* The copy above is written in each language rather than about it,
            so the two names go here — the offer has to be unambiguous when
            the reader can only make out one half of the banner. */}
        <Text variant="micro" className="text-muted-foreground">
          {LOCALE_LABELS[locale]} → {LOCALE_LABELS[suggested]}
        </Text>
      </View>
    </View>
  );
}
