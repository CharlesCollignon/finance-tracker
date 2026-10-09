"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { m, useInView, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BellRinging,
  CalendarStar,
  Eye,
  EyeSlash,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { Orb } from "@/components/brand/Orb";
import {
  featureHref,
  type LandingPageId,
  type LocalisedLandingCopy,
} from "@/components/marketing/landing-copy";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { useLocale } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

type MoreCopy = LocalisedLandingCopy["more"];
type Item = MoreCopy["items"][number];

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** Where each card sits on the six-column grid, from the tablet width up. */
const SPAN: Record<string, string> = {
  together: "md:col-span-4 md:row-span-2",
  questions: "md:col-span-2 md:row-span-2",
  tax: "md:col-span-2",
  year: "md:col-span-2",
  search: "md:col-span-2",
  alerts: "md:col-span-3",
  privacy: "md:col-span-3",
};

/**
 * « Et tout ce qu'il y a autour »: the rest of the app as an uneven grid —
 * the shared space and Questions large, the others a line each — rising in
 * one after another as the grid comes into view. Each card carries a small
 * live picture of what it does, and a soft light under the pointer.
 */
export function FeatureBento({ copy }: { copy: MoreCopy }) {
  return (
    <section className="relative overflow-x-clip px-6 py-28 md:py-40">
      <div className="mx-auto max-w-6xl">
        <h2 className="marketing-display max-w-3xl text-display-section">
          {copy.heading}
        </h2>
        <div className="mt-14 grid auto-rows-[minmax(13rem,auto)] grid-cols-1 gap-4 md:mt-20 md:grid-cols-6">
          {copy.items.map((item, index) => (
            <Card key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({ item, index }: { item: Item; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.35 });
  const [hover, setHover] = useState(false);

  // The light follows the pointer: two custom properties, no render.
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--x",
      `${event.clientX - box.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--y",
      `${event.clientY - box.top}px`,
    );
  }

  const body = (
    <>
      <Picture id={item.id} seen={seen} hover={hover} />
      <div className="mt-auto">
        <h3 className="flex items-center gap-2 font-head text-xl text-marketing-ink">
          {item.title}
          {item.link ? (
            <ArrowRight
              size={16}
              aria-hidden
              className="text-primary transition-transform duration-300 group-hover:translate-x-1"
            />
          ) : null}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-marketing-muted">
          {item.body}
        </p>
      </div>
    </>
  );

  const shell = cn(
    "group relative isolate flex h-full flex-col gap-6 overflow-hidden rounded-[1.75rem] p-6 glass-flat md:p-7",
    "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-500 before:[background:radial-gradient(22rem_circle_at_var(--x,50%)_var(--y,50%),rgb(236_178_94/0.12),transparent_60%)] hover:before:opacity-100",
  );

  return (
    <m.article
      ref={ref}
      className={cn(SPAN[item.id])}
      initial={{ opacity: 0, y: 36, scale: 0.97 }}
      animate={seen ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ duration: 0.9, ease: EASE, delay: (index % 3) * 0.08 }}
      onPointerMove={onPointerMove}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {item.link ? (
        <Link
          href={featureHref(item.id as LandingPageId)}
          className={cn(shell, marketingFocus)}
        >
          {body}
        </Link>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </m.article>
  );
}

/** Each card's small picture of what it does. */
function Picture({
  id,
  seen,
  hover,
}: {
  id: string;
  seen: boolean;
  hover: boolean;
}) {
  switch (id) {
    case "together":
      return <TogetherPicture seen={seen} hover={hover} />;
    case "questions":
      return <QuestionsPicture seen={seen} />;
    case "tax":
      return <TaxPicture seen={seen} />;
    case "year":
      return (
        <IconPicture
          icon={<CalendarStar size={26} weight="light" />}
          seen={seen}
        />
      );
    case "search":
      return <SearchPicture seen={seen} />;
    case "alerts":
      return <AlertPicture seen={seen} />;
    case "privacy":
      return <PrivacyPicture hover={hover} />;
    default:
      return null;
  }
}

/** « Moi · Commun », the pill sliding to the shared side and back. */
function TogetherPicture({ seen, hover }: { seen: boolean; hover: boolean }) {
  const locale = useLocale();
  const euro = useFormatCurrency();
  const { together } = landingSampleFor(locale);
  const shared = seen !== hover;
  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex self-start rounded-full border border-white/12 p-1 text-sm">
        <m.span
          aria-hidden
          className="absolute inset-y-1 left-1 w-24 rounded-full bg-white/10"
          animate={{ x: shared ? "100%" : "0%" }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
        <span className="relative z-10 w-24 py-1 text-center text-marketing-muted">
          {together.me}
        </span>
        <span className="relative z-10 w-24 py-1 text-center text-marketing-ink">
          {together.name}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {["A", "B"].map((initial, index) => (
            <m.span
              key={initial}
              className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-[#1c1c2b] text-sm font-semibold"
              initial={{ x: index === 0 ? -12 : 12, opacity: 0 }}
              animate={seen ? { x: 0, opacity: 1 } : undefined}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.3 + index * 0.1,
              }}
            >
              {initial}
            </m.span>
          ))}
        </div>
        <div
          className="flex h-2 flex-1 overflow-hidden rounded-full"
          aria-hidden
        >
          <m.div
            className="bg-primary"
            initial={{ width: "0%" }}
            animate={seen ? { width: `${together.share}%` } : undefined}
            transition={{ duration: 1.1, ease: EASE, delay: 0.5 }}
          />
          <div className="flex-1 bg-white/15" />
        </div>
        <span className="font-mono text-sm tabular-nums text-marketing-muted">
          {euro(together.myPart)}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {together.rows.slice(0, 3).map((row, index) => (
          <m.li
            key={row.name}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm"
            initial={{ opacity: 0, x: 18 }}
            animate={seen ? { opacity: 1, x: 0 } : undefined}
            transition={{ duration: 0.7, ease: EASE, delay: 0.7 + index * 0.1 }}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.07] text-xs font-semibold">
              {row.by}
            </span>
            <span className="flex-1 text-marketing-ink">{row.name}</span>
            <span className="text-marketing-faint">{row.meta}</span>
            <span className="w-20 text-right font-mono tabular-nums text-marketing-muted">
              {euro(row.amount)}
            </span>
          </m.li>
        ))}
      </ul>
    </div>
  );
}

/** The orb, and a question typing itself out under it. */
function QuestionsPicture({ seen }: { seen: boolean }) {
  const { questions } = landingSampleFor(useLocale());
  const still = useReducedMotion() ?? false;
  const euro = useFormatCurrency();
  const exchange = questions.exchanges[0]!;
  const words = exchange.question.split(" ");
  const figures = Object.fromEntries(
    Object.entries(questions.figures).map(([key, value]) => [key, euro(value)]),
  );
  const answer = exchange.answer[0]!.split(/(\{\w+\})/);
  return (
    <div className="flex flex-1 flex-col items-start gap-5">
      <Orb size="64px" />
      <p className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-marketing-ink">
        {words.map((word, index) => (
          <m.span
            key={`${word}-${index}`}
            initial={{ opacity: still ? 1 : 0 }}
            animate={seen ? { opacity: 1 } : undefined}
            transition={{ duration: 0.2, delay: 0.4 + index * 0.07 }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </m.span>
        ))}
      </p>
      <m.p
        className="ml-6 rounded-2xl rounded-br-md bg-white/[0.03] px-4 py-3 text-sm text-marketing-muted"
        initial={{ opacity: still ? 1 : 0, y: still ? 0 : 10 }}
        animate={seen ? { opacity: 1, y: 0 } : undefined}
        transition={{
          duration: 0.6,
          ease: EASE,
          delay: 0.5 + words.length * 0.07,
        }}
      >
        {answer.map((part, index) => {
          const name = part.match(/^\{(\w+)\}$/)?.[1];
          return name && figures[name] ? (
            <span
              key={index}
              className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-primary"
            >
              {figures[name]}
            </span>
          ) : (
            <span key={index}>{part}</span>
          );
        })}
      </m.p>
    </div>
  );
}

/** Three boxes, their amounts counting into place. */
function TaxPicture({ seen }: { seen: boolean }) {
  const euro = useFormatCurrency();
  const { tax } = landingSampleFor(useLocale());
  return (
    <div className="flex flex-wrap gap-2">
      {tax.boxes.map((box, index) => (
        <m.span
          key={box.id}
          className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs"
          initial={{ opacity: 0, y: 8 }}
          animate={seen ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: EASE, delay: 0.25 + index * 0.1 }}
        >
          <span className="font-mono font-semibold text-marketing-ink">
            {box.id}
          </span>
          <span className="font-mono tabular-nums text-marketing-muted">
            {euro(box.amount)}
          </span>
        </m.span>
      ))}
    </div>
  );
}

function IconPicture({ icon, seen }: { icon: ReactNode; seen: boolean }) {
  return (
    <m.span
      className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-primary"
      initial={{ rotate: -12, scale: 0.8, opacity: 0 }}
      animate={seen ? { rotate: 0, scale: 1, opacity: 1 } : undefined}
      transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.25 }}
    >
      {icon}
    </m.span>
  );
}

/** A search field, the shop typing itself in. */
function SearchPicture({ seen }: { seen: boolean }) {
  const still = useReducedMotion() ?? false;
  const word = "Carrefour";
  return (
    <div className="flex items-center gap-2 self-start rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-sm">
      <MagnifyingGlass size={16} className="text-marketing-muted" />
      <span className="font-mono text-marketing-ink">
        {word.split("").map((letter, index) => (
          <m.span
            key={index}
            initial={{ opacity: still ? 1 : 0 }}
            animate={seen ? { opacity: 1 } : undefined}
            transition={{ duration: 0.05, delay: 0.4 + index * 0.06 }}
          >
            {letter}
          </m.span>
        ))}
      </span>
      <m.span
        aria-hidden
        className="h-4 w-px bg-primary"
        animate={still ? undefined : { opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  );
}

/** A notification sliding down into place. */
function AlertPicture({ seen }: { seen: boolean }) {
  return (
    <m.div
      className="flex items-center gap-3 self-start rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.9)]"
      initial={{ y: -24, opacity: 0 }}
      animate={seen ? { y: 0, opacity: 1 } : undefined}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.3 }}
    >
      <BellRinging size={20} className="text-primary" />
      <span className="h-2 w-28 rounded-full bg-white/20" />
      <span className="h-2 w-12 rounded-full bg-white/10" />
    </m.div>
  );
}

/** Amounts that blur under the pointer, as the privacy blur does. */
function PrivacyPicture({ hover }: { hover: boolean }) {
  const euro = useFormatCurrency();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex size-10 items-center justify-center rounded-full border border-white/12 text-marketing-muted">
        {hover ? <EyeSlash size={18} /> : <Eye size={18} />}
      </span>
      {[2410, 620, 1650].map((amount) => (
        <span
          key={amount}
          className={cn(
            "font-serif text-2xl font-semibold tabular-nums text-marketing-ink transition-[filter] duration-500",
            hover && "blur-md",
          )}
        >
          {euro(amount)}
        </span>
      ))}
    </div>
  );
}
