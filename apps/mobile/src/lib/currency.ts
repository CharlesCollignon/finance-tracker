import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CurrencyCode } from "@finance/core/constants";

const STORAGE_KEY = "currency";

export async function loadCurrency(): Promise<CurrencyCode> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === "USD" ? "USD" : "EUR";
  } catch {
    return "EUR";
  }
}

export async function saveCurrency(currency: CurrencyCode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, currency);
}
