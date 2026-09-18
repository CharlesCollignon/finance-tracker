import "@/global.css";

import { useFonts } from "expo-font";
import {
  Stack,
  usePathname,
  useRouter,
  useSegments,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocaleSuggestion } from "@/components/LocaleSuggestion";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { BiometricLockProvider } from "@/providers/BiometricLockProvider";
import { CurrencyProvider } from "@/providers/CurrencyProvider";
import { LocaleProvider } from "@/providers/LocaleProvider";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/providers/OnboardingProvider";
import { PrivacyProvider } from "@/providers/PrivacyProvider";
import { RefreshProvider } from "@/providers/RefreshProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { useNotificationRouting } from "@/lib/notification-routing";
import { initTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, initializing } = useAuth();
  const { complete: onboarded } = useOnboarding();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  // The banner below is an in-flow sibling above `<Stack>`, not inside any
  // one screen's own `SafeAreaView` — so it has to ask for the top inset
  // itself, or its content sits under the status bar the way a screen's
  // content never does.
  const insets = useSafeAreaInsets();

  // Only once there is a session to land in. Following a tapped notification
  // to the Ledger while signed out would be immediately bounced to /login by
  // the effect below, and the reason for the tap would be lost on the way.
  useNotificationRouting(Boolean(session) && !initializing && fontsReady);

  // Pinned rather than read: Pluclair has one palette, and NativeWind
  // resolves `dark:` variants from the scheme, so a phone in light mode would
  // otherwise render the light half of every variant over a dark palette.
  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    if (initializing || !fontsReady) {
      return;
    }

    SplashScreen.hideAsync();

    const inOnboarding = pathname.startsWith("/onboarding");
    // Send a signed-in user who has not finished setup there once, and only
    // once we actually know the flag.
    if (session && onboarded === false && !inOnboarding) {
      router.replace("/onboarding" as Href);
      return;
    }
    if (inOnboarding) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
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
    segments,
    pathname,
    router,
  ]);

  return (
    <>
      {/* The web twin mounts its equivalent at the same level, above every
          page rather than on one screen — it used to live only on the
          now-retired Month screen here, which meant nobody who skipped that
          screen, or who signed in straight to another one, was ever asked.
          Self-gating: it renders nothing on almost every launch.
          `paddingTop: insets.top` rather than a bare mount, because web's
          body scrolls and can afford to ignore the notch; this sits above a
          `Stack` whose own screens already apply the full inset themselves,
          so the banner has to clear the notch on its own rather than
          borrowing space no screen below it is giving up. */}
      <View style={{ paddingTop: insets.top }}>
        <LocaleSuggestion />
      </View>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="import" />
        <Stack.Screen name="onboarding" />
      </Stack>
      {/* Light glyphs, always: the ground behind them is near-black. */}
      <StatusBar style="light" />
    </>
  );
}

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
    "InstrumentSans-Regular": require("../../assets/fonts/InstrumentSans-Regular.ttf"),
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
                        <OnboardingProvider>
                          <RootNavigator fontsReady={fontsReady} />
                        </OnboardingProvider>
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
