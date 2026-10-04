"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Coins, LinkBreak, Sparkle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { ListRow, ListSection } from "@/components/ui/ListRow";
import { useToast } from "@/components/layout/ToastProvider";
import {
  AI_MODELS,
  type AiCreditState,
  type AiModel,
} from "@finance/core/ai-models";
import { aiBrandOf } from "@finance/core/ai-brands";
import { formatCurrency } from "@finance/core/constants";
import { AiMark } from "@/components/finance/AiMark";
import type { Locale } from "@finance/core/i18n/locale";
import { chooseAiModel, disconnectAiAccount } from "@/lib/actions/ai-account";
import { useLocale, useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/** The rows of this section that open an editor under them. */
export type AiAccountRow = "aiConnect" | "aiModel" | "aiDisconnect";

/** What OpenRouter's round trip came back with, as the callback says it. */
export type AiConnectOutcome = "connected" | "refused" | "expired";

/** Each outcome's sentence, spelled out so the catalogue check can see them. */
const OUTCOME_MESSAGES: Record<AiConnectOutcome, string> = {
  connected: "aiAccount.connected",
  refused: "aiAccount.refused",
  expired: "aiAccount.expired",
};

interface AiAccountSectionProps {
  /** The connected account's model, or null with no account connected. */
  model: AiModel | null;
  /** The round trip just finished, from `?ai=`; null on an ordinary visit. */
  outcome: AiConnectOutcome | null;
  /** The Profile's open row: one at a time, across every section. */
  open: string | null;
  onToggle: (row: AiAccountRow) => void;
  onClose: () => void;
}

/**
 * The user's own AI account (docs/plans/AI_ACCOUNT_PLAN.md, Phase 3).
 *
 * Not connected, one row, and the consent under it: what the reads send,
 * to whom, and where it goes, said before OpenRouter is opened rather than
 * after. Connected, the model the reads are written with, what the key has
 * spent — asked of OpenRouter when the Profile opens, never stored — and the
 * way out.
 */
export function AiAccountSection({
  model,
  outcome,
  open,
  onToggle,
  onClose,
}: AiAccountSectionProps) {
  const { toast } = useToast();
  const locale = useLocale();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [credit, setCredit] = useState<AiCreditState | null>(null);
  const connected = model !== null;

  // Said once, then taken off the address: a reload must not say it again.
  const announced = useRef(false);
  useEffect(() => {
    if (!outcome || announced.current) {
      return;
    }
    announced.current = true;
    toast(
      OUTCOME_MESSAGES[outcome],
      outcome === "connected" ? "success" : "error",
    );
    window.history.replaceState(null, "", window.location.pathname);
  }, [outcome, toast]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    let live = true;
    fetch("/api/ai/connection")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((state: AiCreditState | null) => {
        if (live) {
          setCredit(state ?? { state: "unknown" });
        }
      });
    return () => {
      live = false;
    };
  }, [connected]);

  async function connect() {
    setPending(true);
    const response = await fetch("/api/ai/openrouter/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "redirect" }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as {
      url?: unknown;
      error?: unknown;
    } | null;
    if (!response?.ok || typeof body?.url !== "string") {
      setPending(false);
      toast(
        typeof body?.error === "string" ? body.error : "aiAccount.unavailable",
        "error",
      );
      return;
    }
    // Pending until the page goes: OpenRouter opens in its place.
    window.location.assign(body.url);
  }

  async function choose(next: AiModel) {
    if (next.id === model?.id) {
      onClose();
      return;
    }
    setPending(true);
    const result = await chooseAiModel(next.id);
    setPending(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast(t("aiAccount.modelChosen", { model: next.name }), "success");
    onClose();
  }

  async function disconnect() {
    setPending(true);
    const result = await disconnectAiAccount();
    setPending(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    toast("aiAccount.disconnected", "success");
    onClose();
  }

  const consent =
    open === "aiConnect" ? (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{t("aiAccount.consentWhat")}</p>
        <p className={cn("text-muted-foreground", MICRO)}>
          {t("aiAccount.consentSent")}
        </p>
        <p className={cn("text-muted-foreground", MICRO)}>
          {t("aiAccount.consentWhere")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={connect} disabled={pending}>
            {pending ? t("aiAccount.continuing") : t("aiAccount.continue")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    ) : null;

  if (!connected) {
    return (
      <ListSection
        title={t("aiAccount.section")}
        footer={t("aiAccount.footer")}
      >
        <ListRow
          icon={Sparkle}
          label={t("aiAccount.connect")}
          hint={t("aiAccount.connectHint")}
          onClick={() => onToggle("aiConnect")}
          expanded={consent}
        />
      </ListSection>
    );
  }

  return (
    <ListSection
      title={t("aiAccount.section")}
      footer={t("aiAccount.footerConnected")}
    >
      <ListRow
        icon={Sparkle}
        label={t("aiAccount.model")}
        value={open === "aiModel" ? undefined : <ModelName model={model} />}
        onClick={() => onToggle("aiModel")}
        expanded={
          open === "aiModel" ? (
            <div className="flex flex-col gap-1" role="radiogroup">
              {AI_MODELS.map((option) => {
                const chosen = option.id === model.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={pending}
                    onClick={() => void choose(option)}
                    className={cn(
                      "flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm transition-colors",
                      "hover:bg-secondary/60 active:bg-secondary",
                      chosen && "font-semibold",
                    )}
                  >
                    <ModelName model={option} />
                    {chosen ? <Check size={16} weight="bold" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null
        }
      />
      <CreditRow
        credit={credit}
        locale={locale}
        onReconnect={() => onToggle("aiConnect")}
        expanded={consent}
      />
      <ListRow
        icon={LinkBreak}
        label={t("aiAccount.disconnect")}
        destructive
        onClick={() => onToggle("aiDisconnect")}
        expanded={
          open === "aiDisconnect" ? (
            <div className="flex flex-col gap-3">
              <p className={cn("text-muted-foreground", MICRO)}>
                {t("aiAccount.disconnectBlurb")}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="self-start border-destructive text-destructive"
                onClick={disconnect}
                disabled={pending}
              >
                {t("aiAccount.disconnect")}
              </Button>
            </div>
          ) : null
        }
      />
    </ListSection>
  );
}

/** A model as the Profile names it: its maker's mark, then its name. */
function ModelName({ model }: { model: AiModel }) {
  const brand = aiBrandOf(model.id);
  return (
    <span className="inline-flex items-center gap-2">
      {brand ? <AiMark brand={brand} /> : null}
      {model.name}
    </span>
  );
}

/**
 * What the key has spent this month, and what its limit leaves. A key
 * OpenRouter refuses is a connection that writes nothing, so that row is
 * the way back in: the consent again, and a new key on the same model.
 */
function CreditRow({
  credit,
  locale,
  onReconnect,
  expanded,
}: {
  credit: AiCreditState | null;
  locale: Locale;
  onReconnect: () => void;
  expanded: ReactNode;
}) {
  const t = useT();
  const dollars = (amount: number) => formatCurrency(amount, "USD", locale);

  if (credit?.state === "refused") {
    return (
      <ListRow
        icon={Coins}
        label={t("aiAccount.keyRefused")}
        hint={t("aiAccount.keyRefusedHint")}
        destructive
        onClick={onReconnect}
        expanded={expanded}
      />
    );
  }
  if (credit?.state === "ok") {
    const { usageMonthly, limit, limitRemaining } = credit.credit;
    return (
      <ListRow
        icon={Coins}
        label={t("aiAccount.credit")}
        hint={
          limit !== null && limitRemaining !== null
            ? t("aiAccount.creditLeft", {
                left: dollars(limitRemaining),
                limit: dollars(limit),
              })
            : t("aiAccount.creditNoLimit")
        }
        value={dollars(usageMonthly)}
      />
    );
  }
  return (
    <ListRow
      icon={Coins}
      label={t("aiAccount.credit")}
      hint={credit ? t("aiAccount.creditUnknown") : undefined}
      value={credit ? "—" : "…"}
    />
  );
}
