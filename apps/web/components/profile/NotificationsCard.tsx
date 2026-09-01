"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import {
  checkPushSupport,
  currentSubscription,
  disablePush,
  enablePush,
} from "@/lib/push-client";

interface NotificationsCardProps {
  /** Empty when the deployment has no VAPID key configured. */
  publicKey: string;
}

type State =
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "off" }
  | { kind: "on" };

/**
 * Browser notifications, opted into rather than asked for on arrival.
 *
 * Permission is only requested when the user presses the button here.
 * Prompting on first load is the standard way to be denied permanently, and a
 * denial in a browser is not something the app can undo — the user has to go
 * into site settings, which is why the copy says so when it happens.
 */
export function NotificationsCard({ publicKey }: NotificationsCardProps) {
  const { toast } = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const support = checkPushSupport();
      if (!support.supported) {
        if (!cancelled) {
          setState({ kind: "unsupported", reason: support.reason });
        }
        return;
      }
      const subscription = await currentSubscription();
      if (!cancelled) {
        setState({ kind: subscription ? "on" : "off" });
      }
    }

    void read();
    return () => {
      cancelled = true;
    };
  }, []);

  function turnOn() {
    startTransition(async () => {
      const result = await enablePush(publicKey);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setState({ kind: "on" });
      toast("Notifications on", "success");
    });
  }

  function turnOff() {
    startTransition(async () => {
      const result = await disablePush();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setState({ kind: "off" });
      toast("Notifications off", "success");
    });
  }

  return (
    <Card.Bezel className="w-full" innerClassName="flex flex-col gap-3 p-5">
      <h2 className="text-base font-semibold">Notifications</h2>
      <p className="text-sm text-muted-foreground">
        A note when a spending cap is crossed, and one when a new month opens
        with recurring items ready to apply. Nothing else.
      </p>

      {state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : null}

      {state.kind === "unsupported" ? (
        <p className="text-sm text-muted-foreground">{state.reason}</p>
      ) : null}

      {state.kind === "off" ? (
        <Button
          className="self-start"
          disabled={pending || !publicKey}
          onClick={turnOn}
        >
          {pending ? "Turning on…" : "Turn on notifications"}
        </Button>
      ) : null}

      {state.kind === "on" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-success">On for this browser.</p>
          <Button variant="outline" size="sm" disabled={pending} onClick={turnOff}>
            {pending ? "Turning off…" : "Turn off"}
          </Button>
        </div>
      ) : null}

      {!publicKey && state.kind !== "unsupported" ? (
        <p className="text-sm text-muted-foreground">
          Not configured on this deployment.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Each browser is separate — turning this on here does not affect your
        phone, which has its own reminders in the app.
      </p>
    </Card.Bezel>
  );
}
