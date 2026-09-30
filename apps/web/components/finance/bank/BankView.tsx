"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Bank,
  CheckCircle,
  Lightning,
  Receipt,
  WarningCircle,
} from "@phosphor-icons/react";
import { bankAttention } from "@finance/core/bank-attention";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import type {
  BankAccount,
  BankConnectionStatus,
} from "@finance/core/types/database";
import { Button, buttonVariants } from "@/components/retroui/Button";
import { CashAccountsCard } from "@/components/finance/CashAccountsCard";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { BankImport } from "@/components/finance/bank/BankImport";
import { ConnectBankSheet } from "@/components/finance/bank/ConnectBankSheet";
import { disconnectBank } from "@/lib/actions/bank-connect";
import { GLASS_CARD, GLASS_HERO } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/** Where consents are renewed and wallets topped up: the user's own account. */
const OPEN_BANKING_APP = "https://open-banking.io/app";

export interface BankViewProps {
  /** Whether this deployment can connect anybody at all. */
  available: boolean;
  /** The stored connection, or null when there is none. */
  connection: {
    status: BankConnectionStatus;
    lastSyncedAt: string | null;
    consentValidUntil: string | null;
    backfilled: boolean;
  } | null;
  /** The owner still on the deployment's own credentials: syncing, no row. */
  ownerCredentials: boolean;
  accounts: BankAccount[];
  /** Open the upload on arrival (`?setup=1`). */
  startWithSetup?: boolean;
}

/**
 * The bank connection, in one place: connect it, see it working, fix it,
 * or let it go.
 */
export function BankView({
  available,
  connection,
  ownerCredentials,
  accounts,
  startWithSetup = false,
}: BankViewProps) {
  const t = useT();
  const [connectOpen, setConnectOpen] = useState(startWithSetup);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const live = connection !== null && connection.status !== "revoked";
  const syncing = ownerCredentials || (live && connection.status === "active");

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {!live && !ownerCredentials ? (
        <Invitation
          available={available}
          onConnect={() => setConnectOpen(true)}
        />
      ) : null}

      {live && connection.status !== "active" ? (
        <ProblemCard
          status={connection.status}
          onReconnect={() => setConnectOpen(true)}
        />
      ) : null}

      {syncing ? (
        <StatusCard
          connection={connection}
          ownerCredentials={ownerCredentials}
          onReplace={available ? () => setConnectOpen(true) : null}
        />
      ) : null}

      {live && connection.status === "active" && !connection.backfilled ? (
        <BankImport />
      ) : null}

      {accounts.length > 0 ? (
        <section
          className={cn(GLASS_CARD, "flex flex-col gap-3 rounded-card p-card")}
        >
          <div>
            <h2 className="text-base font-semibold">
              {t("bankConnect.accounts")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("bankConnect.accountsBody")}
            </p>
          </div>
          <CashAccountsCard accounts={accounts} />
        </section>
      ) : null}

      {live ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => setDisconnectOpen(true)}
          >
            {t("bankConnect.disconnect")}
          </Button>
        </div>
      ) : null}

      <ConnectBankSheet open={connectOpen} onOpenChange={setConnectOpen} />
      <DisconnectSheet open={disconnectOpen} onOpenChange={setDisconnectOpen} />
    </div>
  );
}

/** What connecting unlocks — only what already exists for a bank-fed ledger. */
function Invitation({
  available,
  onConnect,
}: {
  available: boolean;
  onConnect: () => void;
}) {
  const t = useT();
  const unlocks = [
    { icon: <Bank size={ICON.md} />, text: t("bankConnect.unlockBalance") },
    { icon: <Receipt size={ICON.md} />, text: t("bankConnect.unlockEntries") },
    {
      icon: <Lightning size={ICON.md} />,
      text: t("bankConnect.unlockArrived"),
    },
    {
      icon: <CheckCircle size={ICON.md} />,
      text: t("bankConnect.unlockClose"),
    },
  ];
  return (
    <section
      className={cn(
        GLASS_CARD,
        GLASS_HERO,
        "flex flex-col gap-5 rounded-card p-card md:p-8",
      )}
    >
      <div>
        <h2 className="text-xl font-semibold">{t("bankConnect.sheetTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("bankConnect.notConnectedBody")}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {unlocks.map((unlock) => (
          <li
            key={unlock.text}
            className="flex items-start gap-3 rounded-control border border-border px-3 py-3 text-sm"
          >
            <span className="mt-0.5 text-primary">{unlock.icon}</span>
            {unlock.text}
          </li>
        ))}
      </ul>
      {available ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={onConnect}>
            {t("bankConnect.sheetTitle")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("bankConnect.priceNote")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("bankConnect.unavailable")}
        </p>
      )}
    </section>
  );
}

function ProblemCard({
  status,
  onReconnect,
}: {
  status: BankConnectionStatus;
  onReconnect: () => void;
}) {
  const t = useT();
  const copy =
    status === "expired"
      ? {
          title: t("bankConnect.expiredTitle"),
          body: t("bankConnect.expiredBody"),
        }
      : status === "paused"
        ? {
            title: t("bankConnect.pausedTitle"),
            body: t("bankConnect.pausedBody"),
          }
        : {
            title: t("bankConnect.errorTitle"),
            body: t("bankConnect.errorBody"),
          };
  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex flex-col gap-3 rounded-card border-warning/40 p-card",
      )}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <WarningCircle size={ICON.lg} weight="fill" className="text-warning" />
        {copy.title}
      </h2>
      <p className="text-sm text-muted-foreground">{copy.body}</p>
      <div>
        {status === "paused" ? (
          <a
            href={OPEN_BANKING_APP}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "md" }), "gap-1.5")}
          >
            {t("bankConnect.openSite")}
            <ArrowSquareOut size={ICON.sm} aria-hidden />
          </a>
        ) : status === "expired" ? (
          <Button type="button" onClick={onReconnect}>
            {t("bankConnect.reconnect")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function StatusCard({
  connection,
  ownerCredentials,
  onReplace,
}: {
  connection: BankViewProps["connection"];
  ownerCredentials: boolean;
  /** Opens the upload for a new file; null where setup is not offered. */
  onReplace: (() => void) | null;
}) {
  const t = useT();
  const locale = useLocale();
  const consent = connection?.consentValidUntil ?? null;
  // The same question the push and the Bearing's banner ask, so the page
  // never says "runs until" on a morning the phone said "renew".
  const renewSoon =
    connection !== null &&
    bankAttention(
      { status: connection.status, consent_valid_until: consent },
      todayIsoLocal(),
    )?.kind === "renew";
  const consentDate = consent
    ? formatShortDate(consent.slice(0, 10), locale)
    : null;

  return (
    <section
      className={cn(GLASS_CARD, "flex flex-col gap-3 rounded-card p-card")}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-success" />
        </span>
        {t("bankConnect.statusConnected")}
      </h2>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowsClockwise size={ICON.sm} />
        {connection?.lastSyncedAt
          ? t("bankConnect.lastSynced", {
              when: new Date(connection.lastSyncedAt).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })
          : t("bankConnect.neverSynced")}
      </p>
      {ownerCredentials ? (
        <p className="text-xs text-muted-foreground">
          {t("bankConnect.sourceOwner")}
        </p>
      ) : null}
      {consentDate ? (
        renewSoon ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-warning/40 px-3 py-2.5">
            <p className="text-sm">
              {t("bankConnect.consentSoon", { date: consentDate })}
            </p>
            {/* Renewed at open-banking.io, where the consent was given: the
                file Pluclair holds does not change. */}
            <a
              href={OPEN_BANKING_APP}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {t("bankConnect.renew")}
              <ArrowSquareOut size={ICON.sm} aria-hidden />
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("bankConnect.consentUntil", { date: consentDate })}
          </p>
        )
      ) : null}
      {onReplace && ownerCredentials ? (
        // The owner's feed runs on the deployment's environment. Uploading
        // the same file here moves it onto the account, where it is looked
        // after like everyone else's.
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-primary/30 bg-accent px-3 py-2.5">
          <p className="min-w-0 flex-1 basis-56 text-sm">
            {t("bankConnect.ownerUpload")}
          </p>
          <Button type="button" size="sm" onClick={onReplace}>
            {t("bankConnect.ownerUploadCta")}
          </Button>
        </div>
      ) : onReplace ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={onReplace}
          >
            {t("bankConnect.replaceFile")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function DisconnectSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [deleteImported, setDeleteImported] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await disconnectBank(deleteImported);
      if (result.error !== undefined) {
        toast(result.error, "error");
        return;
      }
      onOpenChange(false);
      toast(t("bankConnect.disconnected"), "success");
      router.refresh();
    });
  }

  const options = [
    {
      value: false,
      label: t("bankConnect.keepImported"),
      hint: t("bankConnect.keepImportedHint"),
    },
    {
      value: true,
      label: t("bankConnect.deleteImported"),
      hint: t("bankConnect.deleteImportedHint"),
    },
  ];

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("bankConnect.disconnectTitle")}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t("bankConnect.disconnectBody")} {t("bankConnect.disconnectApiKey")}
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">
            {t("bankConnect.disconnectTitle")}
          </legend>
          {options.map((option) => (
            <label
              key={String(option.value)}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-control border px-3 py-2.5",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                deleteImported === option.value
                  ? "border-foreground bg-secondary"
                  : "border-border hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="deleteImported"
                checked={deleteImported === option.value}
                onChange={() => setDeleteImported(option.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.hint}
              </span>
            </label>
          ))}
        </fieldset>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full border-destructive text-destructive"
          disabled={pending}
          onClick={confirm}
        >
          {t("bankConnect.confirmDisconnect")}
        </Button>
      </div>
    </MobileSheet>
  );
}
