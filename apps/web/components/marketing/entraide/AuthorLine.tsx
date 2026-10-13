import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * Who wrote it and when: a pseudonym, the « Pluclair » mark on the owner's
 * answers (ink, not gold: a name is not a moment), and the day in words.
 * Nothing when the account is gone — « Message supprimé » says enough.
 */
export function AuthorLine({
  handle,
  isPluclair,
  when,
  edited,
  pluclairLabel,
  className,
}: {
  handle: string | null;
  isPluclair: boolean;
  when: string;
  edited?: string;
  pluclairLabel: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-marketing-faint",
        className,
      )}
    >
      {handle ? (
        <span className="font-medium text-marketing-muted">{handle}</span>
      ) : null}
      {isPluclair ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-xs text-marketing-ink">
          <SealCheck size={12} weight="fill" aria-hidden />
          {pluclairLabel}
        </span>
      ) : null}
      {handle ? <span aria-hidden>·</span> : null}
      <span>
        {when}
        {edited ? ` · ${edited}` : ""}
      </span>
    </p>
  );
}
