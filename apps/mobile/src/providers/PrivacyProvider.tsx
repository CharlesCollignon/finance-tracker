import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { loadPrivacyHidden, savePrivacyHidden } from "@/lib/privacy";

interface PrivacyContextValue {
  hidden: boolean;
  toggle: () => void;
  ready: boolean;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadPrivacyHidden().then((value) => {
      setHidden(value);
      setReady(true);
    });
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      void savePrivacyHidden(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ hidden, toggle, ready }),
    [hidden, toggle, ready],
  );

  return (
    <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    throw new Error("usePrivacy must be used within PrivacyProvider");
  }
  return ctx;
}
