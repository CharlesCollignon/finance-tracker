"use client";

import { useEffect } from "react";
import { Button } from "@/components/retroui/Button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded border-2 border-border bg-card p-8 shadow-md">
        <p className="font-head text-xl">Something went wrong</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t load this page. Your data is safe — try again, and
          if the problem persists, sign out and back in.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
