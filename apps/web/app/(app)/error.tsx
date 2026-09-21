"use client";

import { useEffect } from "react";
import { Button } from "@/components/retroui/Button";
import { useT } from "@/lib/locale-context";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded-control border border-border bg-card p-8 ">
        <p className="font-head text-xl">{t("errorPage.title")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("errorPage.body")}
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>{t("errorPage.tryAgain")}</Button>
        </div>
      </div>
    </div>
  );
}
