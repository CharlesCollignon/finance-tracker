"use client";

import { useTransition } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { reopenSwallowedFeedItems } from "@/lib/actions/bank";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

interface SwallowedRecoveryProps {
  count: number;
}

/**
 * Bank rows an earlier sync merged away on its own.
 *
 * The sync used to treat an amount matching a recurring transaction within
 * five days as proof they were the same movement. On a statement full of
 * small round figures that is not proof of anything — a ten-euro purchase and
 * a ten-euro weekly DCA look identical to it — so those rows were filed
 * against the DCA and never became transactions. They are not duplicates;
 * they are spending that quietly never arrived.
 *
 * Reopening puts every one of them back in the review inbox, where the
 * decision is the user's. Some really were the debit the template predicted,
 * and those can be left out again — but that is a judgement nothing here is
 * entitled to make.
 */
export function SwallowedRecovery({ count }: SwallowedRecoveryProps) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  if (count === 0) {
    return null;
  }

  function reopen() {
    startTransition(async () => {
      const result = await reopenSwallowedFeedItems();
      toast(
        result.error ?? result.message ?? t("swallowed.reopened"),
        result.error ? "error" : "success",
      );
    });
  }

  return (
    <Card className="block w-full border-destructive/40">
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Card.Title>{t("swallowed.title", { count })}</Card.Title>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={pending}
            onClick={reopen}
          >
            <ArrowCounterClockwise size={ICON.sm} />
            {pending ? t("swallowed.reopening") : t("swallowed.reopenAll")}
          </Button>
        </div>
        <Card.Description>{t("swallowed.body")}</Card.Description>
      </Card.Header>
    </Card>
  );
}
