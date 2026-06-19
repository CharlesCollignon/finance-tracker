import Link from "next/link";
import {
  ArrowsLeftRight,
  CalendarBlank,
  ChartLine,
  ChartPieSlice,
  Repeat,
} from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: ChartPieSlice, title: "Dashboard" },
  { icon: Repeat, title: "Recurring" },
  { icon: ChartLine, title: "Invest" },
  { icon: ArrowsLeftRight, title: "Transactions" },
  { icon: CalendarBlank, title: "Calendar" },
] as const;

interface HeroPageProps {
  isLoggedIn: boolean;
}

export function HeroPage({ isLoggedIn }: HeroPageProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-end border-b-2 border-border bg-background px-4 py-3 md:px-8">
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                )}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4 md:px-8">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          <Logo size="hero" />

          <h1 className="font-head mt-4 max-w-md text-xl font-semibold leading-tight sm:mt-5 sm:text-2xl md:text-3xl">
            {isLoggedIn
              ? "Your finances, one place."
              : "Personal finance, straight to the point."}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground sm:text-base">
            Track income, recurring flows, investments, and spending — no
            spreadsheet.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:mt-5">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "md" }), "min-w-36")}
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className={cn(buttonVariants({ size: "md" }), "min-w-36")}
                >
                  Get started free
                </Link>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "md", variant: "outline" }),
                    "min-w-36",
                  )}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>

        <ul className="mt-5 grid w-full max-w-3xl grid-cols-5 gap-2 sm:mt-6 sm:max-w-4xl sm:gap-3">
          {FEATURES.map(({ icon: Icon, title }) => (
            <li key={title}>
              <Card className="flex h-full flex-col items-center gap-1.5 p-2 text-center sm:gap-2 sm:p-3">
                <span className="flex size-8 shrink-0 items-center justify-center border-2 border-border bg-primary sm:size-9">
                  <Icon size={16} weight="bold" className="sm:hidden" />
                  <Icon
                    size={18}
                    weight="bold"
                    className="hidden sm:block"
                  />
                </span>
                <span className="font-head text-[10px] leading-tight sm:text-xs">
                  {title}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </main>

      <footer className="shrink-0 border-t-2 border-border px-4 py-2.5 text-center text-[10px] text-muted-foreground sm:text-xs md:px-8">
        Built for personal budgeting and long-term investing.
      </footer>
    </div>
  );
}
