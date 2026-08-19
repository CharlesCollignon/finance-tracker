import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";
import { Text } from "@/components/retroui/Text";

interface ICardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Card = ({ className, ...props }: ICardProps) => {
  return (
    <div
      className={cn(
        "inline-block rounded-lg border border-border bg-card",
        className,
      )}
      {...props}
    />
  );
};

interface ICardBezelProps extends ICardProps {
  innerClassName?: string;
}

/** Double-bezel nested card: tinted outer shell around the real surface. */
const CardBezel = ({ className, innerClassName, children, ...props }: ICardBezelProps) => {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-border bg-foreground/[0.04] p-[0.4rem]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-[1.6rem] bg-card shadow-bezel-inset",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
};

const CardHeader = ({ className, ...props }: ICardProps) => {
  return (
    <div
      className={cn("flex flex-col justify-start p-4", className)}
      {...props}
    />
  );
};

const CardTitle = ({ className, ...props }: ICardProps) => {
  return <Text as="h3" className={cn("mb-1", className)} {...props} />;
};

const CardDescription = ({ className, ...props }: ICardProps) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

const CardContent = ({ className, ...props }: ICardProps) => {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
};

const CardComponent = Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Bezel: CardBezel,
});

export { CardComponent as Card };
