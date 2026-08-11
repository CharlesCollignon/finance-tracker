"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
}

/** Light list stagger for page sections. */
export function Stagger({ children, className, stagger = 0.04 }: StaggerProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduce ? 0 : stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.2, ease: "easeOut" },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
