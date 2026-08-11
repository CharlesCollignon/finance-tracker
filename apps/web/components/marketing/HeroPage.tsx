"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { buttonVariants } from "@/components/retroui/Button";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

interface HeroPageProps {
  isLoggedIn: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HeroPage({ isLoggedIn }: HeroPageProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-end px-4 py-4 md:px-8">
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
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
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

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <motion.div
          className="flex w-full max-w-md flex-col items-center text-center"
          initial="hidden"
          animate="show"
          variants={{
            show: { transition: { staggerChildren: 0.08 } },
          }}
        >
          <motion.div variants={fadeUp}>
            <Logo size="hero" />
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-sm text-base text-muted-foreground sm:text-lg"
          >
            Income, recurring, investments — clear and quiet.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
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
                  Get started
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
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
