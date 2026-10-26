"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ICON } from "@/lib/icon-scale";

/** The browser's print dialog, which also saves the page as a PDF. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" size="sm" onClick={() => window.print()} className="gap-2">
      <Printer size={ICON.md} aria-hidden />
      {label}
    </Button>
  );
}
