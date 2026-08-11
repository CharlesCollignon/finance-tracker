"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number;
  y?: number;
}

/** Soft opacity + y enter. Respects prefers-reduced-motion. */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 8,
  ...props
}: FadeInProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay,
        ease: "easeOut",
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
