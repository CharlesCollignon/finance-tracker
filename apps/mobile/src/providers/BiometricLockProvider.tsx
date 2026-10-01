import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Modal, View } from "react-native";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import {
  getBiometricAvailability,
  loadBiometricUnlockEnabled,
  promptBiometric,
  saveBiometricUnlockEnabled,
} from "@/lib/biometrics";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

interface BiometricLockContextValue {
  enabled: boolean;
  hardware: boolean;
  enrolled: boolean;
  ready: boolean;
  enable: () => Promise<{ error?: string }>;
  disable: () => Promise<void>;
}

const BiometricLockContext = createContext<BiometricLockContextValue | null>(
  null,
);

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { session, initializing, signOut } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [hardware, setHardware] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    void Promise.all([
      loadBiometricUnlockEnabled(),
      getBiometricAvailability(),
    ]).then(([pref, availability]) => {
      setEnabled(pref);
      setHardware(availability.hardware);
      setEnrolled(availability.enrolled);
      setReady(true);
    });
  }, []);

  const canLock = enabled && hardware && enrolled && Boolean(session);

  // Signing out unlocks. Adjusted while rendering, the pattern React
  // documents for "reset state when an input changes", instead of an effect
  // that renders twice.
  const [previousSession, setPreviousSession] = useState(session);
  if (session !== previousSession) {
    setPreviousSession(session);
    if (!session) {
      setLocked(false);
    }
  }

  // Lock once at launch, as soon as everything the decision needs is known.
  const [restored, setRestored] = useState(false);
  if (!restored && !initializing && ready) {
    setRestored(true);
    if (session && enabled && hardware && enrolled) {
      setLocked(true);
    }
  }

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === "background" && next === "active" && canLock) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [canLock]);

  const unlock = useCallback(async () => {
    setPrompting(true);
    setMessage(null);
    const result = await promptBiometric(
      t("biometric.unlockPrompt"),
      t("biometric.cancelLabel"),
    );
    setPrompting(false);
    if (result.success) {
      setLocked(false);
      return;
    }
    setMessage(result.error ?? "biometric.couldNotUnlock");
  }, [t]);

  const autoPromptedRef = useRef(false);

  useEffect(() => {
    if (!locked) {
      autoPromptedRef.current = false;
      return;
    }
    if (!ready || autoPromptedRef.current) {
      return;
    }
    autoPromptedRef.current = true;
    void unlock();
  }, [locked, ready, unlock]);

  const enable = useCallback(async () => {
    const availability = await getBiometricAvailability();
    setHardware(availability.hardware);
    setEnrolled(availability.enrolled);
    if (!availability.hardware || !availability.enrolled) {
      return { error: "biometric.needsSetup" };
    }
    const result = await promptBiometric(
      t("biometric.enablePrompt"),
      t("biometric.cancelLabel"),
    );
    if (!result.success) {
      return { error: result.error ?? "biometric.couldNotEnable" };
    }
    await saveBiometricUnlockEnabled(true);
    setEnabled(true);
    return {};
  }, [t]);

  const disable = useCallback(async () => {
    await saveBiometricUnlockEnabled(false);
    setEnabled(false);
    setLocked(false);
  }, []);

  const value = useMemo(
    () => ({ enabled, hardware, enrolled, ready, enable, disable }),
    [enabled, hardware, enrolled, ready, enable, disable],
  );

  return (
    <BiometricLockContext.Provider value={value}>
      {children}
      <Modal
        visible={locked}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          /* stay locked */
        }}
      >
        <View className="flex-1 items-center justify-center gap-8 bg-background px-6">
          <Logo size="hero" />
          <View className="items-center gap-2">
            <Text variant="title" className="text-center">
              {t("biometric.unlockTitle")}
            </Text>
            <Text variant="muted" className="text-center">
              {t("biometric.unlockBody")}
            </Text>
          </View>
          {message ? (
            <Text className="text-center text-destructive">
              {resolveMessage(t, message)}
            </Text>
          ) : null}
          <View className="w-full max-w-sm gap-3">
            <Button
              label={
                prompting ? t("biometric.waiting") : t("biometric.unlockTitle")
              }
              disabled={prompting}
              onPress={() => {
                void unlock();
              }}
            />
            <Button
              label={t("common.usePassword")}
              variant="outline"
              disabled={prompting}
              onPress={() => {
                void signOut();
              }}
            />
          </View>
        </View>
      </Modal>
    </BiometricLockContext.Provider>
  );
}

export function useBiometricLock(): BiometricLockContextValue {
  const ctx = useContext(BiometricLockContext);
  if (!ctx) {
    throw new Error(
      "useBiometricLock must be used within BiometricLockProvider",
    );
  }
  return ctx;
}
