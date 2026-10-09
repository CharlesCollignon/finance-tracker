"use client";

import { m } from "motion/react";
import {
  landingCopyFor,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { RiseWords } from "@/components/marketing/LandingReveal";
import { useLocale } from "@/lib/locale-context";
import { BearingDemo } from "./demos/BearingDemo";
import { ChargesDemo } from "./demos/ChargesDemo";
import { LedgerDemo } from "./demos/LedgerDemo";
import { MonthCloseDemo } from "./demos/MonthCloseDemo";
import { MonthReadDemo } from "./demos/MonthReadDemo";
import { PlanDemo } from "./demos/PlanDemo";
import { PropertyDemo } from "./demos/PropertyDemo";
import { QuestionsDemo } from "./demos/QuestionsDemo";
import { TaxDemo } from "./demos/TaxDemo";
import { TogetherDemo } from "./demos/TogetherDemo";
import { WalletsDemo } from "./demos/WalletsDemo";
import { Stage } from "./demos/parts";

/**
 * A feature page's own hands-on part: its heading rising, a line saying what
 * to do, and the demo on its stage — a different one on every page, each
 * playing the screen's one idea with the landing's sample month.
 */
export function FeatureDemo({ pageId }: { pageId: LandingPageId }) {
  const { demos } = landingCopyFor(useLocale());
  const copy = demos[pageId];
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
      <RiseWords
        as="h2"
        trigger="view"
        text={copy.heading}
        className="marketing-display text-display-section"
      />
      <m.p
        className="mt-4 max-w-xl text-base text-marketing-muted"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.2 }}
      >
        {copy.hint}
      </m.p>
      <m.div
        className="mt-10"
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
      >
        <Stage>
          <Demo pageId={pageId} />
        </Stage>
      </m.div>
    </section>
  );
}

function Demo({ pageId }: { pageId: LandingPageId }) {
  const { demos } = landingCopyFor(useLocale());
  switch (pageId) {
    case "bearing":
      return <BearingDemo />;
    case "ledger":
      return <LedgerDemo copy={demos.ledger} />;
    case "charges":
      return <ChargesDemo copy={demos.charges} />;
    case "month-close":
      return <MonthCloseDemo copy={demos["month-close"]} />;
    case "month-read":
      return <MonthReadDemo copy={demos["month-read"]} />;
    case "plan":
      return <PlanDemo copy={demos.plan} />;
    case "wallets":
      return <WalletsDemo copy={demos.wallets} />;
    case "property":
      return <PropertyDemo copy={demos.property} />;
    case "questions":
      return <QuestionsDemo copy={demos.questions} />;
    case "together":
      return <TogetherDemo copy={demos.together} />;
    case "tax":
      return <TaxDemo copy={demos.tax} />;
  }
}
