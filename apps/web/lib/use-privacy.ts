"use client";

import { useEffect, useState } from "react";
import { formatEuro } from "@finance/core/constants";

export const PRIVACY_MASK = "••••";

export function usePrivacyOn(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      setOn(root.dataset.privacy === "on");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-privacy"],
    });
    return () => observer.disconnect();
  }, []);

  return on;
}

export function privateEuro(amount: number, hidden: boolean): string {
  return hidden ? PRIVACY_MASK : formatEuro(amount);
}
