"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  LayoutGroup,
  LazyMotion,
  MotionConfig,
} from "motion/react";
import type { EntraideFilter, EntraideSort } from "@finance/core/entraide";
import { loadMorePosts } from "@/lib/actions/entraide";
import type { EntraideCard } from "@/lib/entraide-cards";
import type { EntraideCopy } from "@finance/core/entraide-copy";
import { Composer } from "@/components/marketing/entraide/Composer";
import {
  ENTRAIDE_FILTER_PARAM,
  ENTRAIDE_SORT_PARAM,
} from "@/components/marketing/entraide/params";
import { PostCard } from "@/components/marketing/entraide/PostCard";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { SegmentedPills } from "@/components/marketing/SegmentedPills";
import { cn } from "@/lib/utils";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/** A page of the list, as `entraide_list` hands it. */
const PAGE = 20;

/**
 * Entraide's list and what is done to it: « Posez votre question… » on top,
 * then the four doors and the two orders — kept in the address, so a view
 * can be shared — and the cards, re-dealt when either changes (stayers
 * slide, leavers fade, arrivals rise a beat apart). A published question
 * takes the editor's place at the top of the list.
 */
export function EntraideBoard({
  cards,
  filter,
  sort,
  copy,
  signedIn,
  handle,
  loginHref,
  guideSlug,
}: {
  cards: EntraideCard[];
  filter: EntraideFilter;
  sort: EntraideSort;
  copy: EntraideCopy;
  signedIn: boolean;
  handle: string | null;
  loginHref: string;
  guideSlug: string | null;
}) {
  const router = useRouter();
  const [routing, startRouting] = useTransition();
  const [loading, setLoading] = useState(false);
  // What this visit added to the server's page: more of it, and what was
  // just published. Both start again when the view does.
  const view = `${filter}:${sort}`;
  const [shownFor, setShownFor] = useState(view);
  const [more, setMore] = useState<EntraideCard[]>([]);
  const [fresh, setFresh] = useState<
    { card: EntraideCard; layoutId: string }[]
  >([]);
  const [exhausted, setExhausted] = useState(cards.length < PAGE);
  const [generation, setGeneration] = useState(0);
  const [myHandle, setMyHandle] = useState(handle);
  if (shownFor !== view) {
    setShownFor(view);
    setMore([]);
    setFresh([]);
    setExhausted(cards.length < PAGE);
  }

  const freshIds = new Set(fresh.map((item) => item.card.id));
  const listed = [...cards, ...more].filter((card) => !freshIds.has(card.id));

  function go(next: { filter?: EntraideFilter; sort?: EntraideSort }) {
    const params = new URLSearchParams();
    const nextFilter = next.filter ?? filter;
    const nextSort = next.sort ?? sort;
    if (nextFilter !== "all") {
      params.set("filtre", ENTRAIDE_FILTER_PARAM[nextFilter]);
    }
    if (nextSort !== "recent") {
      params.set("tri", ENTRAIDE_SORT_PARAM[nextSort]);
    }
    const search = params.toString();
    startRouting(() => {
      router.push(search ? `?${search}` : "?", { scroll: false });
    });
  }

  async function showMore() {
    setLoading(true);
    const next = await loadMorePosts(filter, sort, cards.length + more.length);
    setLoading(false);
    setExhausted(next.length < PAGE);
    const known = new Set([...cards, ...more].map((card) => card.id));
    setMore((current) => [
      ...current,
      ...next.filter((card) => !known.has(card.id)),
    ]);
  }

  const composerId = `entraide-composer-${generation}`;

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          <div className="flex flex-col gap-10">
            <Composer
              key={composerId}
              copy={copy}
              signedIn={signedIn}
              handle={myHandle}
              loginHref={loginHref}
              layoutId={composerId}
              guideSlug={guideSlug}
              startOpen={Boolean(guideSlug) && generation === 0}
              onPublished={(card) => {
                setFresh((current) => [
                  { card, layoutId: composerId },
                  ...current,
                ]);
                setMyHandle((current) => current ?? card.handle);
                setGeneration((current) => current + 1);
                router.refresh();
              }}
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SegmentedPills
                id="entraide-filter"
                label={copy.filters.label}
                value={filter}
                onChange={(value) => go({ filter: value })}
                options={[
                  { value: "all", label: copy.filters.all },
                  { value: "unanswered", label: copy.filters.unanswered },
                  { value: "solved", label: copy.filters.solved },
                  { value: "shares", label: copy.filters.shares },
                ]}
              />
              <SegmentedPills
                id="entraide-sort"
                label={copy.sorts.label}
                value={sort}
                onChange={(value) => go({ sort: value })}
                options={[
                  { value: "recent", label: copy.sorts.recent },
                  { value: "useful", label: copy.sorts.useful },
                ]}
              />
            </div>

            <ul
              aria-busy={routing}
              className={cn(
                "flex flex-col gap-3 transition-opacity duration-300",
                routing && "opacity-60",
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {fresh.map((item) => (
                  <PostCard
                    key={`fresh-${item.card.id}`}
                    card={item.card}
                    copy={copy}
                    layoutId={item.layoutId}
                  />
                ))}
                {listed.map((card, index) => (
                  <PostCard
                    key={card.id}
                    card={card}
                    copy={copy}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </ul>

            {fresh.length + listed.length === 0 ? (
              <p className="text-center text-marketing-muted">
                {filter === "all" ? copy.list.empty : copy.list.emptyFiltered}
              </p>
            ) : null}

            {!exhausted && listed.length > 0 ? (
              <button
                type="button"
                onClick={() => void showMore()}
                disabled={loading}
                className={cn(
                  "mx-auto min-h-11 rounded-full border border-white/10 px-5 text-sm text-marketing-muted transition-colors duration-hover hover:border-white/20 hover:text-white disabled:opacity-50",
                  marketingFocus,
                )}
              >
                {copy.list.more}
              </button>
            ) : null}
          </div>
        </LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
