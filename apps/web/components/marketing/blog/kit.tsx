import { Children, isValidElement, type ReactNode } from "react";
import { Orb } from "@/components/brand/Orb";
import { formatFullDate } from "@finance/core/constants";
import { cn } from "@/lib/utils";

/**
 * The components a guide is written with, beyond Markdown: steps, where it
 * is in Pluclair, a comparison, a note, and the sources with the day they
 * were checked. Available in every guide without an import
 * (`mdx-components.tsx`).
 */

/** Numbered steps, each a line with its number in a ring. */
export function Steps({ children }: { children?: ReactNode }) {
  const steps = Children.toArray(children).filter(isValidElement);
  return (
    <ol className="my-8 flex flex-col gap-5">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/15 font-head text-sm text-marketing-ink tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 pt-1 text-[1.0625rem] leading-[1.75] text-marketing-ink [&>p]:my-0">
            {step}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Step({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

/** Where a thing lives in the app, said beside the prose about it. */
export function InPluclair({
  where,
  children,
}: {
  where: string;
  children?: ReactNode;
}) {
  return (
    <aside className="glass-flat my-8 flex gap-4 rounded-[1.5rem] p-5 md:p-6">
      <Orb size="1.75rem" tone="mark" className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
          Dans Pluclair · {where}
        </p>
        <div className="mt-2 text-[1rem] leading-[1.7] text-marketing-ink [&>p]:my-2">
          {children}
        </div>
      </div>
    </aside>
  );
}

/** A note beside the line of the text: what is true, but not the point. */
export function Aside({ children }: { children?: ReactNode }) {
  return (
    <aside className="my-6 border-l border-white/15 pl-5 text-[0.975rem] leading-[1.7] text-marketing-muted [&>p]:my-2">
      {children}
    </aside>
  );
}

export interface EnvelopeRow {
  name: string;
  /** What can go in it. */
  holds: string;
  ceiling: string;
  /** When the money can come out without losing what makes it worth it. */
  out: string;
  /** How gains are taxed, in a few words. */
  tax: string;
}

/**
 * The four envelopes side by side: a table on a wide screen, a card each on
 * a phone. The figures are the law's on the day in `checked`.
 */
export function Envelopes({
  rows,
  checked,
}: {
  rows: EnvelopeRow[];
  checked: string;
}) {
  const columns = [
    ["holds", "Ce qu’on y met"],
    ["ceiling", "Plafond des versements"],
    ["out", "Quand sortir l’argent"],
    ["tax", "Sur les gains"],
  ] as const;
  return (
    <figure className="my-10">
      <div className="hidden overflow-hidden rounded-[1.5rem] border border-white/[0.09] md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-white/[0.04] text-marketing-muted">
              <th className="px-4 py-3 font-medium" />
              {columns.map(([, label]) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                className="border-t border-white/[0.07] align-top"
              >
                <th className="px-4 py-4 font-head text-base text-marketing-ink">
                  {row.name}
                </th>
                {columns.map(([key]) => (
                  <td
                    key={key}
                    className="px-4 py-4 leading-relaxed text-marketing-ink"
                  >
                    {row[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.name} className="glass-flat rounded-[1.5rem] p-5">
            <p className="font-head text-lg text-marketing-ink">{row.name}</p>
            <dl className="mt-3 flex flex-col gap-3 text-sm">
              {columns.map(([key, label]) => (
                <div key={key}>
                  <dt className="text-marketing-muted">{label}</dt>
                  <dd className="mt-0.5 leading-relaxed text-marketing-ink">
                    {row[key]}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 text-sm text-marketing-faint">
        Règles en vigueur au {formatFullDate(checked, "fr")} ; elles changent
        avec les lois de finances.
      </figcaption>
    </figure>
  );
}

/** Where the figures come from, and the day each page was read. */
export function Sources({
  items,
}: {
  items: { label: string; href: string; checked: string }[];
}) {
  return (
    <section className="mt-14 border-t border-white/[0.09] pt-6">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
        Sources
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-marketing-muted">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "text-marketing-ink underline decoration-white/30 underline-offset-4 hover:decoration-white/80",
              )}
            >
              {item.label}
            </a>{" "}
            — lu le {formatFullDate(item.checked, "fr")}
          </li>
        ))}
      </ul>
    </section>
  );
}
