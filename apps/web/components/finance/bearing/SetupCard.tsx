"use client";

import Link from "next/link";
import {
  useId,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatDayMonth } from "@finance/core/constants";
import type { SetupStep } from "@finance/core/setup-steps";
import { ConnectBankInvite } from "@/components/finance/bank/ConnectBankInvite";
import { useToast } from "@/components/layout/ToastProvider";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { dismissBankInvite } from "@/lib/actions/bank-connect";
import {
  dismissSetupStep,
  saveBalanceReadingAction,
} from "@/lib/actions/setup";
import { GLASS_CARD } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * Le point's setup card: the one next thing the app needs to say something
 * worth reading (`nextSetupStep`), and nothing once it has it.
 *
 * The balance is typed here, in place: it is one figure, and it is what
 * turns the month from a count from zero into « Il vous reste ». The salary
 * and the charges open the welcome wizard on their step, the one place they
 * are set up from. « Plus tard » puts the card away for good.
 */
export function SetupCard({
  step,
  firstCloseOn,
}: {
  step: SetupStep;
  /** The reading day the first close can be made on. */
  firstCloseOn: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [gone, setGone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (gone) {
    return null;
  }

  function later() {
    setGone(true);
    startTransition(async () => {
      if (step === "bank") {
        await dismissBankInvite("bearing");
      } else {
        await dismissSetupStep(step);
      }
    });
  }

  const laterButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={later}
    >
      {t(step === "bank" ? "setup.withoutBank" : "setup.later")}
    </Button>
  );

  if (step === "bank") {
    return (
      <section
        className={cn(GLASS_CARD, "flex flex-col gap-3 rounded-card p-card")}
      >
        <ConnectBankInvite surface="bearing" variant="card" />
        <div className="self-start">{laterButton}</div>
      </section>
    );
  }

  if (step === "balance") {
    return <BalanceStep laterButton={laterButton} />;
  }

  const copy = {
    salary: {
      title: t("setup.salary.title"),
      body: t("setup.salary.body"),
      href: "/welcome?from=income",
      action: t("setup.salary.action"),
    },
    charges: {
      title: t("setup.charges.title"),
      body: t("setup.charges.body"),
      href: "/welcome?from=recurring",
      action: t("setup.charges.action"),
    },
    close: {
      title: t("setup.close.title", {
        date: formatDayMonth(firstCloseOn, locale),
      }),
      body: t("setup.close.body"),
      href: null,
      action: null,
    },
  }[step];

  return (
    <section
      className={cn(GLASS_CARD, "flex flex-col gap-3 rounded-card p-card")}
    >
      <div>
        <h2 className="text-base font-semibold">{copy.title}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {copy.body}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {copy.href ? (
          <Link
            href={copy.href}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            {copy.action}
          </Link>
        ) : null}
        {laterButton}
      </div>
    </section>
  );
}

/** What the account holds today, typed once. */
function BalanceStep({ laterButton }: { laterButton: ReactNode }) {
  const t = useT();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const fieldId = useId();
  const errorId = useId();
  const amount = parseTypedAmount(value);
  const unreadable = value.trim() !== "" && amount === null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (amount === null) {
      return;
    }
    startTransition(async () => {
      const result = await saveBalanceReadingAction(amount);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("actions.balanceSet"), "success");
    });
  }

  return (
    <section
      className={cn(GLASS_CARD, "flex flex-col gap-3 rounded-card p-card")}
    >
      <div>
        <h2 className="text-base font-semibold">
          <label htmlFor={fieldId}>{t("setup.balance.title")}</label>
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t("setup.balance.body")}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 basis-48 flex-col gap-1.5">
          <Input
            id={fieldId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("monthClose.balancePlaceholder")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={unreadable || undefined}
            aria-describedby={unreadable ? errorId : undefined}
          />
          {unreadable ? (
            <span
              id={errorId}
              role="alert"
              className="text-sm text-destructive"
            >
              {t("errors.notABalance")}
            </span>
          ) : null}
        </div>
        <Button type="submit" size="sm" disabled={pending || amount === null}>
          {t("setup.balance.save")}
        </Button>
        {laterButton}
      </form>
    </section>
  );
}
