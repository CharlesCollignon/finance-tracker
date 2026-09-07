"use client";

import { useState } from "react";
import { Button } from "@/components/retroui/Button";
import { createClient } from "@/lib/supabase/client";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

export type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

interface PasskeysPanelProps {
  initialPasskeys: PasskeyItem[];
}

/**
 * The passkey list, as the body of a settings row rather than a card.
 *
 * This was a card with its own heading and a paragraph explaining what a
 * passkey is. The heading is now the row that opens it and the paragraph is
 * the section footer, so what is left here is the part that could not be a
 * row: a variable-length list with an action on each entry.
 */
export function PasskeysPanel({ initialPasskeys }: PasskeysPanelProps) {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>(initialPasskeys);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      setMessage(error.message);
      setPasskeys([]);
      return;
    }
    setPasskeys(data ?? []);
  }

  async function onAdd() {
    setMessage(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.registerPasskey();
    setPending(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refresh();
  }

  async function onDelete(passkeyId: string) {
    setMessage(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.passkey.delete({ passkeyId });
    setPending(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {passkeys.length === 0 ? (
        <p className={cn("text-muted-foreground", MICRO)}>No passkeys yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {passkeys.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {item.friendly_name ?? "Passkey"}
                </p>
                <p className={cn("text-muted-foreground", MICRO)}>
                  {`Added ${item.created_at.slice(0, 10)}`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void onDelete(item.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() => void onAdd()}
      >
        {pending ? "Please wait…" : "Add passkey"}
      </Button>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
