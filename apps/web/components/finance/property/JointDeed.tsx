"use client";

import { useState, useTransition } from "react";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from "motion/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { initialOf } from "@/components/layout/SpaceContext";
import { useToast } from "@/components/layout/ToastProvider";
import { percent, SplitEditor } from "@/components/space/SplitEditor";
import { setPropertyShareAction } from "@/lib/actions/property";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** What the page knows of a home owned through the space. */
export interface JointDeedView {
  /** The reader's part of the deed. */
  mine: number;
  selfName: string;
  partnerName: string;
}

/**
 * « Parts de l'acte », on a home the space owns (6c): who owns what of it,
 * as two discs sized by their part and a bar between them — each partner's
 * net worth counts theirs. Set once, from either side.
 */
export function JointDeed({
  propertyId,
  deed,
}: {
  propertyId: string;
  deed: JointDeedView;
}) {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(share: number) {
    startTransition(async () => {
      const result = await setPropertyShareAction(propertyId, share);
      toast(
        result.error ?? result.message ?? t("profile.saved"),
        result.error ? "error" : "success",
      );
      if (!result.error) {
        setOpen(false);
      }
    });
  }

  const people = [
    { name: deed.selfName, part: deed.mine, mine: true },
    { name: deed.partnerName, part: 1 - deed.mine, mine: false },
  ];

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <section className="flex flex-col gap-3 rounded-control border border-border/60 p-4">
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">{t("property.deedRow")}</h3>
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
            >
              {t("property.deedEdit")}
            </button>
          </header>
          <div className="flex items-center gap-4">
            {people.map((person, index) => (
              <m.div
                key={person.name + index}
                initial={{ opacity: 0, x: index === 0 ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="flex items-center gap-2"
              >
                <m.span
                  aria-hidden
                  initial={false}
                  // Sized by the part they own, within reason.
                  animate={{ scale: 0.8 + person.part * 0.5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full font-head text-sm font-semibold",
                    person.mine
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground",
                  )}
                >
                  {initialOf(person.name)}
                </m.span>
                <span className="text-sm">
                  <span className="font-medium">{percent(person.part)}</span>{" "}
                  <span className="text-muted-foreground">{person.name}</span>
                </span>
              </m.div>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {open ? (
              <m.div
                key="editor"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="overflow-hidden"
              >
                <SplitEditor
                  initial={deed.mine}
                  partnerName={deed.partnerName}
                  hint={t("property.deedHint")}
                  label={t("property.deedRow")}
                  pending={pending}
                  onSave={save}
                />
              </m.div>
            ) : null}
          </AnimatePresence>
        </section>
      </MotionConfig>
    </LazyMotion>
  );
}
