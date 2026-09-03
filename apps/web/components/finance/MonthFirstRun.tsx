import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

/**
 * The screen a brand-new account actually lands on.
 *
 * Until now it was the standing card reporting "Left in September — 0 €",
 * with nothing came in and nothing went out underneath. That is a correct
 * answer to a question nobody asked, and it teaches the reader that the app
 * has nothing to offer them. The guided setup exists, but it is reachable
 * only in the seconds after signing up: anyone who skipped it, or who signed
 * in later on another device, never saw it again.
 *
 * The steps are numbered because they are genuinely a sequence — the second
 * cannot be done before the first, and the third happens on its own once the
 * other two are done. Numbering anything else would be decoration.
 */
export function MonthFirstRun() {
  const steps = [
    {
      n: 1,
      title: "Name what your money is for",
      body: "Rent, groceries, salary, savings. Six or seven is plenty to start.",
      href: "/categories",
      action: "Categories",
    },
    {
      n: 2,
      title: "Add what you already know repeats",
      body: "Rent, a subscription, the transfer into savings. Each one only has to be entered once.",
      href: "/recurring",
      action: "Plan",
    },
    {
      n: 3,
      title: "Then this screen fills itself in",
      body: "Every month is written from what repeats, and you correct the difference rather than typing it all out.",
      href: null,
      action: null,
    },
  ];

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-head text-xl">Let&apos;s get the month started</h2>
        <p className="text-sm text-muted-foreground">
          Pluclair works from what repeats. Two things to set up, and it takes
          about a minute.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums"
            >
              {step.n}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
              {step.href ? (
                <Link
                  href={step.href}
                  className="mt-1 flex w-fit items-center gap-1 text-sm font-medium text-primary-ink"
                >
                  {step.action}
                  <ArrowRight size={13} />
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <Link
        href="/welcome"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
      >
        Or walk me through it
      </Link>
    </section>
  );
}
