import { Children, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

/**
 * A guide's own Markdown, drawn on the marketing room's ground: a reading
 * measure, prose in the ink grey (the brightest of the three, because it is
 * read for minutes rather than glanced at), headings that carry their own
 * anchor for the margin's contents.
 */

/** The words inside an element, for a heading's anchor. */
export function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  return "";
}

/** « Le jour de lecture » → `le-jour-de-lecture`. */
export function anchorOf(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function H2({ children }: { children?: ReactNode }) {
  return (
    <h2
      id={anchorOf(textOf(children))}
      data-guide-section
      className="mb-5 mt-16 scroll-mt-32 font-head text-2xl leading-tight tracking-[-0.02em] text-marketing-ink first:mt-0 md:text-[1.75rem]"
    >
      {children}
    </h2>
  );
}

export function H3({ children }: { children?: ReactNode }) {
  return (
    <h3 className="mb-3 mt-10 font-head text-lg text-marketing-ink md:text-xl">
      {children}
    </h3>
  );
}

export function P({ children }: { children?: ReactNode }) {
  return (
    <p className="my-5 text-[1.0625rem] leading-[1.8] text-marketing-ink">
      {children}
    </p>
  );
}

export function A({
  href = "",
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const className = cn(
    "rounded-control text-marketing-ink underline decoration-white/30 underline-offset-4 transition-colors duration-hover hover:decoration-white/80",
    marketingFocus,
  );
  return href.startsWith("/") ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export function Ul({ children }: { children?: ReactNode }) {
  return (
    <ul className="my-5 flex flex-col gap-2.5 text-[1.0625rem] leading-[1.75] text-marketing-ink">
      {Children.map(children, (child) =>
        isValidElement(child) ? (
          <li className="flex gap-3">
            <span
              aria-hidden
              className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-white/50"
            />
            <span className="min-w-0">
              {(child.props as { children?: ReactNode }).children}
            </span>
          </li>
        ) : null,
      )}
    </ul>
  );
}

export function Ol({ children }: { children?: ReactNode }) {
  return (
    <ol className="my-5 flex list-decimal flex-col gap-2.5 pl-6 text-[1.0625rem] leading-[1.75] text-marketing-ink marker:text-marketing-muted">
      {children}
    </ol>
  );
}

export function Strong({ children }: { children?: ReactNode }) {
  return (
    <strong className="font-semibold text-marketing-ink">{children}</strong>
  );
}

export function Hr() {
  return <hr className="marketing-rule my-12 border-0" />;
}
