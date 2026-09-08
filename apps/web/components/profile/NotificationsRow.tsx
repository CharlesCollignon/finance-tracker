"use client";

import { useEffect, useState, useTransition } from "react";
import { BellSimple } from "@phosphor-icons/react";

import { ListRow } from "@/components/ui/ListRow";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/layout/ToastProvider";
import { useT } from "@/lib/locale-context";
import {
  checkPushSupport,
  currentSubscription,
  disablePush,
  enablePush,
} from "@/lib/push-client";

interface NotificationsRowProps {
  /** Empty when the deployment has no VAPID key configured. */
  publicKey: string;
}

type State =
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "off" }
  | { kind: "on" };

/**
 * Browser notifications, as a switch.
 *
 * Permission is only requested when the user flips this. Prompting on first
 * load is the standard way to be denied permanently, and a denial in a
 * browser is not something the app can undo — the user has to go into site
 * settings, which is why the failure is reported rather than swallowed.
 *
 * The reason a browser cannot take them shows as the row's value rather than
 * hiding the row: "not supported here" is an answer, and a setting that
 * vanishes on some browsers is one the user goes looking for.
 */
export function NotificationsRow({ publicKey }: NotificationsRowProps) {
  const t = useT();
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

  function change(next: boolean) {
    startTransition(async () => {
      const result = next ? await enablePush(publicKey) : await disablePush();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setState({ kind: next ? "on" : "off" });
      toast(next ? "Notifications on" : "Notifications off", "success");
    });
  }

  const unavailable = state.kind === "unsupported" || !publicKey;
  const value =
    state.kind === "loading"
      ? "Checking…"
      : state.kind === "unsupported"
        ? state.reason
        : !publicKey
          ? "Not configured here"
          : undefined;

  return (
    <ListRow
      icon={BellSimple}
      label={t("common.capsAndNewMonths")}
      value={value}
      disabled={unavailable || state.kind === "loading"}
      trailing={
        <Switch
          label={t("common.browserNotifications")}
          checked={state.kind === "on"}
          disabled={unavailable || state.kind === "loading" || pending}
          onChange={change}
        />
      }
    />
  );
}
