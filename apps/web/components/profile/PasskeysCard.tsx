"use client";

import { useState } from "react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Text } from "@/components/retroui/Text";
import { createClient } from "@/lib/supabase/client";

export type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

interface PasskeysCardProps {
  initialPasskeys: PasskeyItem[];
}

export function PasskeysCard({ initialPasskeys }: PasskeysCardProps) {
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
    <Card.Bezel className="w-full" innerClassName="p-4 md:p-5">
      <h2 className="text-base font-semibold">Passkeys</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Passwordless sign-in on this browser. Bound to pluclair.com.
      </p>
      {passkeys.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No passkeys yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {passkeys.map((item) => {
            const label = item.friendly_name ?? "Passkey";
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <Text className="text-sm">{label}</Text>
                  <p className="text-xs text-muted-foreground">
                    Added {item.created_at.slice(0, 10)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    void onDelete(item.id);
                  }}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 w-full md:w-auto"
        disabled={pending}
        onClick={() => {
          void onAdd();
        }}
      >
        {pending ? "Please wait…" : "Add passkey"}
      </Button>
      {message ? (
        <p className="mt-2 text-sm text-destructive">{message}</p>
      ) : null}
    </Card.Bezel>
  );
}
