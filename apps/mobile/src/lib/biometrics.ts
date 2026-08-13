import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const STORAGE_KEY = "pluclair.biometric-unlock";

export interface BiometricAvailability {
  hardware: boolean;
  enrolled: boolean;
}

export async function loadBiometricUnlockEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === "1";
  } catch {
    return false;
  }
}

export async function saveBiometricUnlockEnabled(
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return { hardware, enrolled };
  } catch {
    return { hardware: false, enrolled: false };
  }
}

export async function promptBiometric(
  promptMessage: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    if (result.success) {
      return { success: true };
    }
    if (result.error === "user_cancel" || result.error === "system_cancel") {
      return { success: false, error: "Cancelled." };
    }
    return {
      success: false,
      error: result.warning ?? "Biometric unlock failed.",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Biometric unlock failed.",
    };
  }
}
