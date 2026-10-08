"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { Button, ButtonNub } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { initialOf } from "@/components/layout/SpaceContext";
import { joinSpaceAction, showJointAction } from "@/lib/actions/space";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { resolveMessage } from "@finance/core/i18n/t";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** How long the two discs hold together before the Bearing opens. */
const JOINED_HOLD_MS = 900;

export type JoinState =
  | { kind: "signedOut" }
  | { kind: "unusable" }
  | { kind: "here"; spaceName: string }
  | { kind: "elsewhere"; spaceName: string }
  | { kind: "open"; spaceName: string; invitedBy: string; self: string };

/**
 * The invite, as its reader sees it: who is asking and to what, then one
 * button. Joining brings the two discs together — they glide in when the
 * page opens, and on « Rejoindre » they lock with a small bump, hold a
 * moment, and the space opens on the Bearing.
 */
export function JoinSpaceCard({
  state,
  token,
}: {
  state: JoinState;
  token: string;
}) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <Card.Bezel
          className="w-full"
          innerClassName="flex flex-col items-center gap-4 px-6 py-8 text-center"
        >
          <JoinBody state={state} token={token} />
        </Card.Bezel>
      </MotionConfig>
    </LazyMotion>
  );
}

function JoinBody({ state, token }: { state: JoinState; token: string }) {
  const t = useT();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [joined, setJoined] = useState(false);
  // Said in the card rather than as a toast: this page is outside the app
  // shell, and the card is the one thing on it.
  const [error, setError] = useState<string | null>(null);

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await joinSpaceAction(token);
      if (result.error) {
        setError(result.error);
        return;
      }
      setJoined(true);
      setTimeout(() => router.push("/bearing"), reduced ? 0 : JOINED_HOLD_MS);
    });
  }

  function open() {
    startTransition(async () => {
      await showJointAction(true);
      router.push("/bearing");
    });
  }

  if (state.kind === "signedOut") {
    return (
      <>
        <Pair left="?" right="?" together={false} />
        <Heading>{t("space.joinSignedOutTitle")}</Heading>
        <Body>{t("space.joinSignedOutBody")}</Body>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="pill" render={<Link href="/signup" />}>
            {t("auth.createAccount")}
            <ButtonNub>
              <ArrowRight size={ICON.md} />
            </ButtonNub>
          </Button>
          <Button variant="outline" render={<Link href="/login" />}>
            {t("auth.signIn")}
          </Button>
        </div>
      </>
    );
  }

  if (state.kind === "unusable") {
    return (
      <>
        <Heading>{t("space.inviteUnusable")}</Heading>
        <Body>{t("space.joinUnusableBody")}</Body>
        <Button variant="outline" render={<Link href="/bearing" />}>
          {t("nav.bearing")}
        </Button>
      </>
    );
  }

  if (state.kind === "here") {
    return (
      <>
        <Heading>{t("space.joinAlreadyHere")}</Heading>
        <Body>{state.spaceName}</Body>
        <Button variant="pill" onClick={open} disabled={pending}>
          {t("space.joinOpen")}
          <ButtonNub>
            <ArrowRight size={ICON.md} />
          </ButtonNub>
        </Button>
      </>
    );
  }

  if (state.kind === "elsewhere") {
    return (
      <>
        <Heading>{t("space.alreadyInOne")}</Heading>
        <Body>{t("space.joinElsewhereBody")}</Body>
        <Button variant="outline" render={<Link href="/profile" />}>
          {t("nav.profile")}
        </Button>
      </>
    );
  }

  return (
    <>
      <Pair
        left={initialOf(state.invitedBy)}
        right={initialOf(state.self)}
        together={joined}
      />
      <Heading>
        {t("space.joinTitle", {
          name: state.invitedBy,
          space: state.spaceName,
        })}
      </Heading>
      <Body>{t("space.joinBody", { name: state.invitedBy })}</Body>
      <Button
        variant="pill"
        size="lg"
        onClick={join}
        disabled={pending || joined}
      >
        {joined ? t("space.joined") : t("space.join")}
        <ButtonNub>
          <ArrowRight size={ICON.md} />
        </ButtonNub>
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {resolveMessage(t, error)}
        </p>
      ) : null}
    </>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <m.h1
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.15 }}
      className="font-head text-2xl leading-tight"
    >
      {children}
    </m.h1>
  );
}

function Body({ children }: { children: string }) {
  return (
    <m.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.25 }}
      className="max-w-sm text-sm text-muted-foreground"
    >
      {children}
    </m.p>
  );
}

/**
 * The inviter on the left, the reader on the right. They glide in from the
 * edges and stop short of each other; joining closes the gap.
 */
function Pair({
  left,
  right,
  together,
}: {
  left: string;
  right: string;
  together: boolean;
}) {
  const disc =
    "flex size-16 items-center justify-center rounded-full border-4 border-background font-head text-2xl font-semibold";
  const spring = { type: "spring", stiffness: 240, damping: 18 } as const;
  return (
    <div aria-hidden className="relative flex h-20 items-center justify-center">
      {/* One ring, once, when the two meet. */}
      {together ? (
        <m.span
          initial={{ opacity: 0.5, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="absolute size-20 rounded-full border-2 border-foreground/30"
        />
      ) : null}
      <m.span
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: together ? 10 : -4, opacity: 1 }}
        transition={spring}
        className={cn(disc, "z-10 bg-foreground text-background")}
      >
        {left}
      </m.span>
      <m.span
        initial={{ x: 40, opacity: 0 }}
        animate={{
          x: together ? -10 : 4,
          opacity: 1,
          scale: together ? [1, 1.08, 1] : 1,
        }}
        // A spring takes two keyframes; the bump takes three.
        transition={{ ...spring, scale: { duration: 0.4, ease: EASE } }}
        className={cn(disc, "bg-muted text-foreground")}
      >
        {right}
      </m.span>
    </div>
  );
}
