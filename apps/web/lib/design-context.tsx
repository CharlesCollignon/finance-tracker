"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isLightDesign, type Design } from "@finance/core/designs";

interface DesignContextValue {
  design: Design;
  /**
   * Repaint the page in another design at once, before the server has
   * answered: the attribute and the `dark` class on <html> are all the CSS
   * reads. The caller saves the choice (`setDesignPreference`); the server's
   * next render of the root layout then agrees with what is already shown.
   */
  preview: (design: Design) => void;
}

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({
  design: initial,
  children,
}: {
  design: Design;
  children: ReactNode;
}) {
  const [design, setDesign] = useState<Design>(initial);

  const preview = useCallback((next: Design) => {
    const root = document.documentElement;
    root.dataset.design = next;
    root.classList.toggle("dark", !isLightDesign(next));
    setDesign(next);
  }, []);

  const value = useMemo(() => ({ design, preview }), [design, preview]);
  return (
    <DesignContext.Provider value={value}>{children}</DesignContext.Provider>
  );
}

/** The design on screen; « Nuit » outside a provider. */
export function useDesign(): DesignContextValue {
  return (
    useContext(DesignContext) ?? {
      design: "nuit",
      preview: () => {},
    }
  );
}
