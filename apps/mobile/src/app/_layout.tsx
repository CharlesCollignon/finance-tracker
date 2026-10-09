import "@/global.css";

import { useFonts } from "expo-font";
import {
  DarkTheme,
  Stack,
  ThemeProvider,
  usePathname,
  useRouter,
  useSegments,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocaleSuggestion } from "@/components/LocaleSuggestion";
import { ScreenErrorBoundary } from "@/components/ScreenError";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { BiometricLockProvider } from "@/providers/BiometricLockProvider";
import { CurrencyProvider } from "@/providers/CurrencyProvider";
import { LocaleProvider } from "@/providers/LocaleProvider";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/providers/OnboardingProvider";
import { OwnerProvider } from "@/providers/OwnerProvider";
import { PrivacyProvider } from "@/providers/PrivacyProvider";
import { RefreshProvider } from "@/providers/RefreshProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { useNotificationRouting } from "@/lib/notification-routing";
import { useQuickActionRouting } from "@/lib/quick-action-routing";
import { initTheme } from "@/lib/theme";
import { COLORS } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();

/**
 * The navigators' own ground, Pluclair's near-black rather than React
 * Navigation's light grey. Every screen paints its own background, but the
 * container under them showed through for a frame on each change of screen —
 * the white flash between tabs and on opening a property.
 */
const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.background,
    card: COLORS.background,
    border: COLORS.border,
    primary: COLORS.primary,
    text: COLORS.foreground,
  },
};

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, initializing } = useAuth();
  const { complete: onboarded } = useOnboarding();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  // Only once there is a session to land in. Following a tapped notification
  // to the Ledger while signed out would be immediately bounced to /login by
  // the effect below, and the reason for the tap would be lost on the way.
  useNotificationRouting(Boolean(session) && !initializing && fontsReady);
  // A home-screen quick action, on the same terms.
  useQuickActionRouting(Boolean(session) && !initializing && fontsReady);

  // Pinned rather than read: Pluclair has one palette, and NativeWind
  // resolves `dark:` variants from the scheme, so a phone in light mode would
  // otherwise render the light half of every variant over a dark palette.
  useEffect(() => {
    initTheme();
  }, []);

  const inOnboarding = pathname.startsWith("/onboarding");
  const inAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (initializing || !fontsReady) {
      return;
    }

    SplashScreen.hideAsync();

    // Send a signed-in user who has not finished setup there once, and only
    // once we actually know the flag.
    if (session && onboarded === false && !inOnboarding) {
      router.replace("/onboarding" as Href);
      return;
    }
    if (inOnboarding) {
      return;
    }

    // The OAuth redirect lands on /auth/callback before the session exists.
    // Bouncing it to /login here would cancel the sign-in it is completing.
    const inAuthCallback = pathname.startsWith("/auth/callback");
    if (!session && !inAuthGroup && !inAuthCallback) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [
    session,
    initializing,
    fontsReady,
    onboarded,
    inAuthGroup,
    inOnboarding,
    pathname,
    router,
  ]);

  // Nothing is drawn until the fonts are in: a screen laid out with the
  // fallback face keeps the widths it measured with it, which cut « Le point »
  // to « Le poi… » and the month to « octobre 20… » on the first screen of
  // every launch, until a change of screen measured them again. The splash
  // screen stays up meanwhile.
  if (!fontsReady) {
    return null;
  }

  return (
    <ThemeProvider value={NAVIGATION_THEME}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="bank" />
        <Stack.Screen name="import" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="year" />
        <Stack.Screen name="join/[token]" />
        <Stack.Screen name="ask" />
        <Stack.Screen name="tax" />
      </Stack>
      {/* The web twin mounts its equivalent at the same level, above every
          page rather than on one screen — it used to live only on the
          now-retired Month screen here, which meant nobody who skipped that
          screen, or who signed in straight to another one, was ever asked.

          After `<Stack>`, not before it, and absolutely positioned: it is an
          overlay rather than a row, so it can neither displace a screen nor
          double its top inset — see the component's own comment for the
          three separate times this mount point has been wrong.

          Asked only of somebody who is signed in and past setup. Signed out
          means `(auth)`, where the reader is typing a password and the whole
          question is noise; mid-onboarding means the walkthrough is already
          asking them about a currency and a cap, and a fourth card over the
          top of it is not a question, it is an interruption. `onboarded ===
          true` rather than `!== false`, because null means the flag has not
          been read yet and an unanswered question is not a "yes". */}
      <LocaleSuggestion
        enabled={
          Boolean(session) &&
          !initializing &&
          onboarded === true &&
          !inOnboarding &&
          !inAuthGroup
        }
      />
      {/* Light glyphs, always: the ground behind them is near-black. */}
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

/**
 * A screen that throws while rendering shows a card with a retry, inside the
 * app's providers and with the tab bar or header still there. Declared once
 * here, every screen below inherits it, the tabs' included; `ErrorBoundary`
 * below stays for what fails before the providers are up.
 */
export const unstable_settings = {
  screenErrorBoundary: ScreenErrorBoundary,
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Orbit: require("../../assets/fonts/OrbitMaxenceDuterne-Regular.otf"),
    // Two static instances rather than the variable font that used to sit
    // here. React Native cannot set variation axes, so a variable Fraunces
    // renders only its default location — and this file's default was
    // wght 900 / opsz 9, which is why `font-serif` had been drawing Black
    // text at the smallest optical size despite being named Regular. Both
    // are instanced at opsz 48, the middle of the range TYPE.figure (32) and
    // TYPE.hero (56) actually render at.
    "Fraunces-Regular": require("../../assets/fonts/Fraunces-Regular.ttf"),
    "Fraunces-SemiBold": require("../../assets/fonts/Fraunces-SemiBold.ttf"),
    // Static instances again, one per weight, for the reason given above:
    // `font-medium`, `font-semibold` and `font-bold` are turned into these
    // families by `sansWeightFace` (src/lib/text-class.ts).
    "InstrumentSans-Regular": require("../../assets/fonts/InstrumentSans-Regular.ttf"),
    "InstrumentSans-Medium": require("../../assets/fonts/InstrumentSans-Medium.ttf"),
    "InstrumentSans-SemiBold": require("../../assets/fonts/InstrumentSans-SemiBold.ttf"),
    "InstrumentSans-Bold": require("../../assets/fonts/InstrumentSans-Bold.ttf"),
    "IBMPlexMono-Regular": require("../../assets/fonts/IBMPlexMono-Regular.ttf"),
    "IBMPlexMono-Medium": require("../../assets/fonts/IBMPlexMono-Medium.ttf"),
  });

  const fontsReady = fontsLoaded || fontError != null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            {/* Directly below AuthProvider, whose user is what lets the choice
                follow somebody to another device, and above every provider
                that reads a label. BiometricLockProvider is one of them — it
                draws the lock screen — so it has to sit inside this and not
                around it. `useT` throws when its context is missing rather
                than falling back to English, so a consumer mounted above this
                line takes the first render down to the ErrorBoundary, and
                RootNavigator never gets to hide the splash screen. */}
            <LocaleProvider>
              <BiometricLockProvider>
                <PrivacyProvider>
                  <CurrencyProvider>
                    <ToastProvider>
                      {/* Inside ToastProvider: a refresh reports its outcome
                          through a toast. Outside the navigator, so one request
                          is in flight at a time whichever screen is showing. */}
                      <RefreshProvider>
                        {/* Whose money the shared screens show: the
                            person's, or their space's under « Commun ». */}
                        <OwnerProvider>
                          <OnboardingProvider>
                            <RootNavigator fontsReady={fontsReady} />
                          </OnboardingProvider>
                        </OwnerProvider>
                      </RefreshProvider>
                    </ToastProvider>
                  </CurrencyProvider>
                </PrivacyProvider>
              </BiometricLockProvider>
            </LocaleProvider>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
