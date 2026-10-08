"use client";

import { useState, useTransition } from "react";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from "motion/react";
import {
  ChartPieSlice,
  Check,
  Copy,
  DownloadSimple,
  PencilSimple,
  Plus,
  ShareNetwork,
  SignOut,
} from "@phosphor-icons/react";
import { EASE_STANDARD } from "@finance/core/motion";
import type { Space } from "@finance/data/spaces";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListRow, ListSection } from "@/components/ui/ListRow";
import { initialOf } from "@/components/layout/SpaceContext";
import { useToast } from "@/components/layout/ToastProvider";
import {
  createSpaceAction,
  createSpaceInviteAction,
  exportSpaceAction,
  leaveSpaceAction,
  renameSpaceAction,
  setMyShareAction,
} from "@/lib/actions/space";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** The discs' spring: they meet, settle, and stay. */
const MEET_SPRING = { type: "spring", stiffness: 260, damping: 20 } as const;

/** How long « Copié » stays before the button reads « Copier » again. */
const COPIED_MS = 1600;

type OpenRow = "name" | "share" | "leave" | null;

/**
 * « Espace commun » in Profile: making the space, the link that brings the
 * partner in, its name, and leaving it with its rows in hand.
 *
 * The two discs at the top are the space: yours alone with an empty seat
 * beside it while nobody has joined, then the two of you meeting in the
 * middle. They arrive once and rest, like every moment in the app.
 */
export function SpaceSection({
  space,
  userId,
  selfName,
}: {
  space: Space | null;
  userId: string;
  selfName: string;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<OpenRow>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const partner =
    space?.members.find((member) => member.userId !== userId) ?? null;
  const myShare =
    space?.members.find((member) => member.userId === userId)?.share ?? 0.5;

  function toggle(row: Exclude<OpenRow, null>) {
    setOpen((current) => (current === row ? null : row));
  }

  function create() {
    startTransition(async () => {
      const result = await createSpaceAction();
      toast(
        result.error ?? result.message ?? "space.created",
        result.error ? "error" : "success",
      );
    });
  }

  function invite() {
    startTransition(async () => {
      const result = await createSpaceInviteAction();
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      setInviteUrl(`${window.location.origin}/join/${result.token}`);
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      toast("errors.couldNotSave", "error");
    }
  }

  async function send(url: string) {
    if (typeof navigator.share !== "function") {
      await copy(url);
      return;
    }
    try {
      await navigator.share({ text: t("space.inviteShareText"), url });
    } catch {
      // Closed without sending: nothing to say.
    }
  }

  function rename(formData: FormData) {
    const name = String(formData.get("name") ?? "");
    startTransition(async () => {
      const result = await renameSpaceAction(name);
      toast(
        result.error ?? result.message ?? t("profile.saved"),
        result.error ? "error" : "success",
      );
      if (!result.error) {
        setOpen(null);
      }
    });
  }

  function saveShare(share: number) {
    startTransition(async () => {
      const result = await setMyShareAction(share);
      toast(
        result.error ?? result.message ?? t("profile.saved"),
        result.error ? "error" : "success",
      );
      if (!result.error) {
        setOpen(null);
      }
    });
  }

  function exportRows() {
    startTransition(async () => {
      const result = await exportSpaceAction();
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      if (result.count === 0) {
        toast(t("ledger.exportNothing"), "error");
        return;
      }
      download(`${space?.name ?? "commun"}.csv`, result.csv);
      toast(t("ledger.exported", { count: result.count }), "success");
    });
  }

  function leave() {
    startTransition(async () => {
      const result = await leaveSpaceAction();
      toast(
        result.error ?? result.message ?? "space.left",
        result.error ? "error" : "success",
      );
      if (!result.error) {
        setOpen(null);
        setInviteUrl(null);
      }
    });
  }

  const stage = !space ? "empty" : partner ? "together" : "waiting";

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <ListSection title={t("space.section")} footer={t("space.footer")}>
          <div className="flex flex-col items-center gap-3 px-5 pb-5 pt-6 text-center">
            <Pair
              self={selfName}
              partner={partner?.name ?? null}
              stage={stage}
            />
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={stage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="flex flex-col items-center gap-1.5"
              >
                <p className="font-head text-lg">
                  {space ? space.name : t("space.emptyTitle")}
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {stage === "empty"
                    ? t("space.emptyBody")
                    : stage === "waiting"
                      ? t("space.waitingBody")
                      : t("space.togetherBody", { name: partner!.name })}
                </p>
              </m.div>
            </AnimatePresence>

            {stage === "empty" ? (
              <Button size="sm" onClick={create} disabled={pending}>
                <Plus size={ICON.md} className="mr-1.5" />
                {t("space.create")}
              </Button>
            ) : null}

            {stage === "waiting" && !inviteUrl ? (
              <Button size="sm" onClick={invite} disabled={pending}>
                <ShareNetwork size={ICON.md} className="mr-1.5" />
                {t("space.invite")}
              </Button>
            ) : null}

            <AnimatePresence initial={false}>
              {stage === "waiting" && inviteUrl ? (
                <m.div
                  key="link"
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="flex w-full max-w-sm flex-col gap-2"
                >
                  <div className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-4 pr-1">
                    <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-muted-foreground">
                      {inviteUrl}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-0 rounded-full"
                      onClick={() => void copy(inviteUrl)}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <m.span
                          key={copied ? "copied" : "copy"}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ duration: 0.16, ease: EASE }}
                          className="flex items-center gap-1"
                        >
                          {copied ? (
                            <Check size={ICON.sm} weight="bold" />
                          ) : (
                            <Copy size={ICON.sm} />
                          )}
                          {copied
                            ? t("space.inviteCopied")
                            : t("space.inviteCopy")}
                        </m.span>
                      </AnimatePresence>
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    className="self-center"
                    onClick={() => void send(inviteUrl)}
                  >
                    <ShareNetwork size={ICON.md} className="mr-1.5" />
                    {t("space.inviteSend")}
                  </Button>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>

          {space ? (
            <>
              <ListRow
                icon={PencilSimple}
                label={t("space.name")}
                value={open === "name" ? undefined : space.name}
                onClick={() => toggle("name")}
                expanded={
                  open === "name" ? (
                    <form action={rename} className="flex flex-col gap-3">
                      <Input
                        name="name"
                        type="text"
                        defaultValue={space.name}
                        aria-label={t("space.name")}
                        maxLength={40}
                        required
                        className="text-base"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="self-start"
                        disabled={pending}
                      >
                        {pending ? t("profile.saving") : t("profile.save")}
                      </Button>
                    </form>
                  ) : null
                }
              />
              <ListRow
                icon={ChartPieSlice}
                label={t("space.shareRow")}
                value={
                  open === "share"
                    ? undefined
                    : `${percent(myShare)} · ${percent(1 - myShare)}`
                }
                onClick={() => toggle("share")}
                expanded={
                  open === "share" ? (
                    <ShareEditor
                      initial={myShare}
                      partnerName={partner?.name ?? t("space.partner")}
                      pending={pending}
                      onSave={saveShare}
                    />
                  ) : null
                }
              />
              <ListRow
                icon={SignOut}
                label={t("space.leave")}
                destructive
                onClick={() => toggle("leave")}
                expanded={
                  open === "leave" ? (
                    <div className="flex flex-col gap-3">
                      <p className={cn("text-muted-foreground", MICRO)}>
                        {partner
                          ? t("space.leaveBody", { name: partner.name })
                          : t("space.leaveLastBody")}
                      </p>
                      {/* The rows first: once out, they cannot be read. */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="self-start"
                        onClick={exportRows}
                        disabled={pending}
                      >
                        <DownloadSimple size={ICON.md} className="mr-1.5" />
                        {t("space.export")}
                      </Button>
                      <Button
                        size="sm"
                        className="self-start bg-destructive text-destructive-foreground"
                        onClick={leave}
                        disabled={pending}
                      >
                        {t("space.leaveConfirm")}
                      </Button>
                    </div>
                  ) : null
                }
              />
            </>
          ) : null}
        </ListSection>
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * You, and beside you your partner or the seat they will take. The discs
 * slide in from either side; once there are two, they overlap a little.
 */
function Pair({
  self,
  partner,
  stage,
}: {
  self: string;
  partner: string | null;
  stage: "empty" | "waiting" | "together";
}) {
  const disc =
    "flex size-12 items-center justify-center rounded-full border-2 border-background font-head text-lg font-semibold";
  return (
    <div aria-hidden className="flex h-12 items-center">
      <m.span
        initial={{ x: -18, opacity: 0 }}
        animate={{ x: stage === "together" ? 6 : 0, opacity: 1 }}
        transition={MEET_SPRING}
        className={cn(disc, "z-10 bg-foreground text-background")}
      >
        {initialOf(self)}
      </m.span>
      <AnimatePresence mode="popLayout" initial={false}>
        {partner ? (
          <m.span
            key="partner"
            initial={{ x: 24, opacity: 0, scale: 0.8 }}
            animate={{ x: -6, opacity: 1, scale: 1 }}
            transition={MEET_SPRING}
            className={cn(disc, "bg-muted text-foreground")}
          >
            {initialOf(partner)}
          </m.span>
        ) : (
          <m.span
            key="seat"
            initial={{ x: 18, opacity: 0 }}
            animate={{
              x: 4,
              opacity: stage === "empty" ? 0.5 : 1,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={MEET_SPRING}
            className={cn(
              disc,
              "border-dashed border-muted-foreground/50 bg-transparent text-muted-foreground",
            )}
          >
            <Plus size={ICON.md} />
          </m.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A part as a whole percent: « 60 % ». */
function percent(part: number): string {
  return `${Math.round(part * 100)}\u00A0%`;
}

/**
 * The split, set by sliding: the bar between the two of you moves with the
 * thumb, each side named and counted, and one press saves it for both.
 */
function ShareEditor({
  initial,
  partnerName,
  pending,
  onSave,
}: {
  initial: number;
  partnerName: string;
  pending: boolean;
  onSave: (share: number) => void;
}) {
  const t = useT();
  const [share, setShare] = useState(Math.round(initial * 20) / 20);

  return (
    <div className="flex flex-col gap-3">
      <p className={cn("text-muted-foreground", MICRO)}>
        {t("space.shareHint")}
      </p>
      <div className="flex items-baseline justify-between text-sm font-medium">
        <span>{t("space.shareYou", { part: percent(share) })}</span>
        <span className="text-muted-foreground">
          {t("space.sharePartner", {
            name: partnerName,
            part: percent(1 - share),
          })}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <m.span
          className="h-full bg-foreground"
          initial={false}
          animate={{ width: `${share * 100}%` }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(share * 100)}
        onChange={(event) => setShare(Number(event.target.value) / 100)}
        aria-label={t("space.shareRow")}
        aria-valuetext={`${percent(share)} · ${percent(1 - share)}`}
        className="w-full accent-foreground"
      />
      <Button
        size="sm"
        className="self-start"
        disabled={pending || share === initial}
        onClick={() => onSave(share)}
      >
        {pending ? t("profile.saving") : t("profile.save")}
      </Button>
    </div>
  );
}

function download(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
