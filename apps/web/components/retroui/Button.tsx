import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import React, { type ButtonHTMLAttributes } from "react";
import { Button as BaseButton } from "@base-ui/react/button";

export const buttonVariants = cva(
  "font-medium rounded-md cursor-pointer duration-200 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] transition-all",
  {
    variants: {
      variant: {
        // The rim is not decoration: a gold fill is 1.7:1 against the page,
        // so without it the button's edge disappears.
        default:
          "border border-primary-rim bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        outline:
          "bg-transparent border border-border text-foreground hover:bg-muted",
        link: "bg-transparent text-foreground underline-offset-4 hover:underline",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        pill: "group rounded-full border border-primary-rim bg-primary text-primary-foreground hover:bg-primary-hover",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-2.5 text-base",
        icon: "p-2",
      },
    },
    compoundVariants: [
      { variant: "pill", size: "sm", class: "pl-4 pr-1 py-1" },
      { variant: "pill", size: "md", class: "pl-5 pr-1.5 py-1.5" },
      { variant: "pill", size: "lg", class: "pl-6 pr-2 py-2" },
    ],
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  },
);

type BaseButtonRender = React.ComponentProps<typeof BaseButton>["render"];

export interface IButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  render?: BaseButtonRender;
}

export const Button = ({
  children,
  size = "md",
  className = "",
  variant = "default",
  render,
  ref,
  ...props
}: IButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  return (
    <BaseButton
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      render={render}
      nativeButton={render ? false : undefined}
      {...props}
    >
      {children}
    </BaseButton>
  );
};

/** Circular chip for a pill button's trailing icon — nests flush inside the button's end padding. */
export function ButtonNub({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/10 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
      {children}
    </span>
  );
}
