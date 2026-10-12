import type { ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

/**
 * A way out of the page, as a glass card: its mark in a ring, what it is,
 * one line under it, and the arrow that lifts toward where it goes. The
 * about page's source and address, Nouveautés' feed and code.
 */
export function ElsewhereLink({
  href,
  title,
  detail,
  icon,
}: {
  href: string;
  title: string;
  detail: string;
  icon: ReactNode;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "glass-flat glass-flat-hover group flex min-h-24 items-center gap-5 rounded-[1.75rem] p-6",
        marketingFocus,
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/12 text-marketing-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-head text-lg text-marketing-ink">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-sm text-marketing-muted">
          {detail}
        </span>
      </span>
      <ArrowUpRight
        size={18}
        aria-hidden
        className="shrink-0 text-marketing-muted transition-transform duration-hover group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </a>
  );
}
