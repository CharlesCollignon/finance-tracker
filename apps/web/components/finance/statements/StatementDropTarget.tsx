"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from "motion/react";
import { FileArrowDown } from "@phosphor-icons/react";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { holdStatementFile } from "@/lib/statements/pending";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** Whether a drag carries files, rather than text or a link from the page. */
function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * A bank's file dropped anywhere in the app is a statement to import: the
 * page dims under « Déposez le relevé pour l'importer », and the drop opens
 * the import with the file already read. Not on the import itself, whose
 * own drop zone is there for it.
 */
export function StatementDropTarget() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const active = pathname !== "/import";

  useEffect(() => {
    if (!active) {
      return;
    }
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      depth.current += 1;
      setOver(true);
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) {
        setOver(false);
      }
    };
    const overPage = (event: DragEvent) => {
      if (carriesFiles(event)) {
        event.preventDefault();
      }
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      depth.current = 0;
      setOver(false);
      const file = event.dataTransfer?.files[0];
      if (file) {
        holdStatementFile(file);
        router.push("/import");
      }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overPage);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overPage);
      window.removeEventListener("drop", drop);
    };
  }, [active, router]);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {over && active ? (
            <m.div
              key="drop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.press / 1000, ease: EASE }}
              className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
            >
              <m.div
                initial={{ scale: 0.94, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 360, damping: 24 }}
                className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-primary bg-card px-10 py-12 text-center"
              >
                <m.span
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <FileArrowDown
                    size={ICON.hero}
                    aria-hidden
                    className="text-primary"
                  />
                </m.span>
                <p className="font-head text-lg">
                  {t("statements.dropAnywhere")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("statements.formats")}
                </p>
              </m.div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </MotionConfig>
    </LazyMotion>
  );
}
