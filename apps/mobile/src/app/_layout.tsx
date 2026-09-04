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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { BiometricLockProvider } from "@/providers/BiometricLockProvider";
import { CurrencyProvider } from "@/providers/CurrencyProvider";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/providers/OnboardingProvider";
import { PrivacyProvider } from "@/providers/PrivacyProvider";
import { RefreshProvider } from "@/providers/RefreshProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { initTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, initializing } = useAuth();
  const { complete: onboarded } = useOnboarding();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

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
    "Fraunces-Regular": require("../../assets/fonts/Fraunces-Regular.ttf"),
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
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
