import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { BlogCopy } from "@/components/marketing/blog-copy";
import { GuideCover } from "@/components/marketing/blog/GuideCover";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { guideHref, type GuideMeta, type GuideSlug } from "@/lib/guide-list";
import { cn } from "@/lib/utils";

/**
 * A guide to open: its cover, its rubrique and length, its title and lede.
 * Wide for the one « À la une », the cover beside the words; otherwise the
 * cover above them. The whole card is the link, and lifts a little under
 * the pointer, as the site's glass cards do.
 */
export function GuideCard({
  slug,
  meta,
  copy,
  wide = false,
  kicker,
}: {
  slug: GuideSlug;
  meta: GuideMeta;
  copy: BlogCopy;
  wide?: boolean;
  /** Above the rubrique: « À la une », « Guide suivant ». */
  kicker?: string;
}) {
  return (
    <Link
      href={guideHref(slug)}
      className={cn(
        "glass-flat glass-flat-hover group grid h-full overflow-hidden rounded-[2rem]",
        wide && "md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]",
        marketingFocus,
      )}
    >
      <GuideCover
        seed={meta.cover}
        className={cn("aspect-[16/9]", wide && "md:aspect-auto md:min-h-80")}
      />
      <div className="flex flex-col gap-3 p-6 md:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
          {kicker ? `${kicker} · ` : ""}
          {copy.rubriques[meta.rubrique]} ·{" "}
          {copy.minutes.replace("{minutes}", String(meta.minutes))}
        </p>
        <h2
          className={cn(
            "font-head leading-tight tracking-[-0.02em] text-marketing-ink",
            wide ? "text-2xl md:text-3xl" : "text-xl",
          )}
        >
          {meta.title}
        </h2>
        <p className="text-[0.975rem] leading-relaxed text-marketing-muted">
          {meta.description}
        </p>
        <ArrowRight
          size={18}
          aria-hidden
          className="mt-auto text-marketing-muted transition-transform duration-hover group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}
