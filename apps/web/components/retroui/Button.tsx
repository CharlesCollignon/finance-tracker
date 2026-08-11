import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import React, { type ButtonHTMLAttributes } from "react";
import { Button as BaseButton } from "@base-ui/react/button";

export const buttonVariants = cva(
  "font-medium rounded-md cursor-pointer duration-200 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] transition-all",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        outline:
          "bg-transparent border border-border text-foreground hover:bg-muted",
        link: "bg-transparent text-foreground underline-offset-4 hover:underline",
        ghost: "bg-transparent text-foreground hover:bg-muted",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-2.5 text-base",
        icon: "p-2",
      },
    },
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
