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

interface BiometricLockContextValue {
  enabled: boolean;
  hardware: boolean;
  enrolled: boolean;
  ready: boolean;
  enable: () => Promise<{ error?: string }>;
  disable: () => Promise<void>;
}

const BiometricLockContext =
  createContext<BiometricLockContextValue | null>(null);

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const { session, initializing, signOut } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [hardware, setHardware] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const restoredRef = useRef(false);
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

  useEffect(() => {
    if (!session) {
      setLocked(false);
    }
  }, [session]);

  useEffect(() => {
    if (initializing || !ready || restoredRef.current) {
      return;
    }
    restoredRef.current = true;
    if (session && enabled && hardware && enrolled) {
      setLocked(true);
    }
  }, [initializing, ready, session, enabled, hardware, enrolled]);

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
    const result = await promptBiometric("Unlock Pluclair");
    setPrompting(false);
    if (result.success) {
      setLocked(false);
      return;
    }
    setMessage(result.error ?? "Could not unlock.");
  }, []);

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
      return {
        error: "Set up Face ID or a fingerprint in system settings first.",
      };
    }
    const result = await promptBiometric("Enable biometric unlock");
    if (!result.success) {
      return { error: result.error ?? "Could not enable biometric unlock." };
    }
    await saveBiometricUnlockEnabled(true);
    setEnabled(true);
    return {};
  }, []);

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
        <View className="flex-1 items-center justify-center gap-8 bg-background px-6 dark:bg-background-dark">
          <Logo size="hero" />
          <View className="items-center gap-2">
            <Text variant="title" className="text-center">
              Unlock
            </Text>
            <Text variant="muted" className="text-center">
              Use Face ID or your fingerprint to open Pluclair.
            </Text>
          </View>
          {message ? (
            <Text className="text-center text-destructive">{message}</Text>
          ) : null}
          <View className="w-full max-w-sm gap-3">
            <Button
              label={prompting ? "Waiting…" : "Unlock"}
              disabled={prompting}
              onPress={() => {
                void unlock();
              }}
            />
            <Button
              label="Use password"
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
