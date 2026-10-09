"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { INVESTMENT_WALLET_COLORS } from "@finance/core/investments";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import { RiseWords } from "@/components/marketing/LandingReveal";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import {
  AvVisual,
  CryptoVisual,
  CtoVisual,
  fill,
  LivretVisual,
  PeaVisual,
  PerVisual,
  useEnvelopeFacts,
} from "./demos/EnvelopeVisuals";
import { Stage } from "./demos/parts";

const ORDER = ["pea", "av", "cto", "per", "crypto", "livret"] as const;
type EnvelopeId = (typeof ORDER)[number];

/** Each card's dot is the colour the app's charts give that wallet. */
const DOT: Record<EnvelopeId, string> = {
  ...INVESTMENT_WALLET_COLORS,
  livret: "rgb(255 255 255 / 0.55)",
};

const EASE = [0.32, 0.72, 0, 1] as const;
const LIFT = { type: "spring", stiffness: 300, damping: 22 } as const;

/**
 * Placements' own extra: the envelopes a French saver keeps, as a hand of
 * cards. The hand is closed until it scrolls in, and fans open as it
 * arrives; a card lifts under the pointer and, chosen, rises out of the
 * hand while the panel beside it opens on that envelope — a small moving
 * picture of what it is about, what Pluclair keeps for it, and what tax
 * takes from it in 2026. On a phone the hand is a row of cards to swipe.
 */
export function EnvelopeDeck() {
  const { demos } = landingCopyFor(useLocale());
  const copy = demos.wallets.envelopes;
  const facts = useEnvelopeFacts();
  const [chosen, setChosen] = useState<EnvelopeId>("pea");
  const still = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  // How far each card turns from the next, in degrees: as much as the
  // column has room for, so the open hand never reaches past it.
  const handRef = useRef<HTMLDivElement>(null);
  const turn = useMotionValue(8);
  useEffect(() => {
    const hand = handRef.current;
    if (!hand) return;
    const observer = new ResizeObserver(([entry]) => {
      const half = entry!.contentRect.width / 2;
      turn.set(Math.min(8.5, Math.max(3, (half - 56) / 20.4)));
    });
    observer.observe(hand);
    return () => observer.disconnect();
  }, [turn]);
  const opened = useSpring(
    useTransform(scrollYProgress, [0.15, 0.85], [0, 1]),
    { stiffness: 90, damping: 20 },
  );

  const cards = ORDER.map((id) => ({
    id,
    name: copy.items[id].name,
    full: copy.items[id].full,
    badge: fill(copy.items[id].badge, facts[id].badge),
    badgeLabel: copy.items[id].badgeLabel,
  }));
  const item = copy.items[chosen];

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

      <div
        ref={ref}
        className="mt-10 grid items-center gap-8 md:mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
      >
        <div
          role="group"
          aria-label={copy.heading}
          ref={handRef}
          className="relative hidden h-[25rem] md:block"
        >
          {cards.map((card, index) => (
            <FanCard
              key={card.id}
              card={card}
              slot={index - (ORDER.length - 1) / 2}
              order={index}
              chosen={card.id === chosen}
              onChoose={() => setChosen(card.id)}
              opened={opened}
              turn={turn}
              still={still}
            />
          ))}
        </div>

        <div
          role="group"
          aria-label={copy.heading}
          className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 md:hidden"
        >
          {cards.map((card) => (
            <m.button
              key={card.id}
              type="button"
              aria-pressed={card.id === chosen}
              onClick={() => setChosen(card.id)}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "flex w-36 shrink-0 snap-start flex-col gap-3 rounded-3xl border p-4 text-left transition-colors duration-300 [background:linear-gradient(165deg,#1b1b28,#0d0d15_75%)]",
                card.id === chosen
                  ? "border-primary/60 shadow-[0_0_30px_-10px_rgb(236_178_94/0.7)]"
                  : "border-white/10",
                marketingFocus,
              )}
            >
              <CardHead card={card} />
              <span className="font-head text-lg leading-tight text-marketing-ink">
                {card.badge}
              </span>
            </m.button>
          ))}
        </div>

        <Stage className="lg:min-h-[33rem]">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={chosen}
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: DOT[chosen] }}
                />
                <h3 className="font-head text-2xl text-marketing-ink">
                  {item.name}
                </h3>
              </div>
              <p className="mt-1 text-sm text-marketing-faint">{item.full}</p>
              <div className="mt-8">
                <Visual id={chosen} />
              </div>
              <dl className="mt-8 grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2">
                <Fact label={copy.inApp}>{item.inApp}</Fact>
                <Fact label={copy.tax}>
                  {fill(item.tax, facts[chosen].tax)}
                </Fact>
              </dl>
            </m.div>
          </AnimatePresence>
        </Stage>
      </div>
    </section>
  );
}

interface Card {
  id: EnvelopeId;
  name: string;
  full: string;
  badge: string;
  badgeLabel: string;
}

function CardHead({ card }: { card: Card }) {
  return (
    <span className="flex items-start justify-between gap-2">
      <span className="font-head text-xl leading-tight text-marketing-ink">
        {card.name}
      </span>
      <span
        className="mt-2 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: DOT[card.id] }}
      />
    </span>
  );
}

/**
 * One card of the hand. Its place in the fan — the turn about a point well
 * below it, and the step sideways — grows with `opened`, and in the hand
 * only its name shows, as a held card shows its corner. Chosen, it rises
 * out of its place upright and turns its figure up; `pick` carries it
 * between the two on a spring.
 */
function FanCard({
  card,
  slot,
  order,
  chosen,
  onChoose,
  opened,
  turn,
  still,
}: {
  card: Card;
  slot: number;
  order: number;
  chosen: boolean;
  onChoose: () => void;
  opened: MotionValue<number>;
  turn: MotionValue<number>;
  still: boolean;
}) {
  const pick = useSpring(chosen ? 1 : 0, { stiffness: 170, damping: 22 });
  useEffect(() => {
    if (still) {
      pick.jump(chosen ? 1 : 0);
    } else {
      pick.set(chosen ? 1 : 0);
    }
  }, [pick, chosen, still]);
  // Its place in the open hand, and how far the hand is open.
  const place = () => slot * turn.get() * (still ? 1 : opened.get());
  const rotate = useTransform(() => place() * (1 - pick.get()));
  const x = useTransform(() => place() * 2.4);
  const y = useTransform(() => pick.get() * -52);
  const scale = useTransform(() => 1 + pick.get() * 0.05);
  return (
    <m.div
      className="absolute bottom-4 left-1/2 -ml-20 h-56 w-40"
      style={{
        rotate,
        x,
        y,
        scale,
        transformOrigin: "50% 150%",
        zIndex: chosen ? 20 : order,
      }}
    >
      <m.button
        type="button"
        aria-pressed={chosen}
        onClick={onChoose}
        whileHover={still || chosen ? undefined : { y: -16 }}
        whileTap={{ scale: 0.97 }}
        transition={LIFT}
        className={cn(
          "flex size-full flex-col justify-between rounded-[1.6rem] border p-5 text-left shadow-[0_30px_60px_-30px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow] duration-300 [background:linear-gradient(165deg,#1d1d2b,#0d0d15_72%)]",
          chosen
            ? "border-primary/60 shadow-[0_0_50px_-14px_rgb(236_178_94/0.75)]"
            : "border-white/10 hover:border-white/25",
          marketingFocus,
        )}
      >
        <span>
          <CardHead card={card} />
          <span className="mt-1 block text-xs leading-snug text-marketing-faint">
            {card.full}
          </span>
        </span>
        <m.span
          animate={{ opacity: chosen ? 1 : 0, y: chosen ? 0 : 8 }}
          transition={{ duration: 0.35, delay: chosen ? 0.15 : 0 }}
        >
          <span className="block font-head text-2xl leading-tight text-marketing-ink">
            {card.badge}
          </span>
          <span className="mt-1 block text-xs text-marketing-muted">
            {card.badgeLabel}
          </span>
        </m.span>
      </m.button>
    </m.div>
  );
}

function Visual({ id }: { id: EnvelopeId }) {
  const { demos } = landingCopyFor(useLocale());
  const items = demos.wallets.envelopes.items;
  switch (id) {
    case "pea":
      return <PeaVisual copy={items.pea} />;
    case "av":
      return <AvVisual copy={items.av} />;
    case "cto":
      return <CtoVisual copy={items.cto} />;
    case "per":
      return <PerVisual copy={items.per} />;
    case "crypto":
      return <CryptoVisual copy={items.crypto} />;
    case "livret":
      return <LivretVisual copy={items.livret} />;
  }
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-marketing-faint">
        {label}
      </dt>
      <dd className="mt-2 text-sm leading-relaxed text-marketing-muted">
        {children}
      </dd>
    </div>
  );
}
