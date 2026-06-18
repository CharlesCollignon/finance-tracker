import {
  Bank,
  Barbell,
  Buildings,
  Car,
  ChartLine,
  CreditCard,
  CurrencyBtc,
  DotsThree,
  HouseSimple,
  Lightning,
  PiggyBank,
  Shield,
  ShoppingCartSimple,
  Television,
  TrendUp,
  Wallet,
  WifiHigh,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, Icon> = {
  wallet: Wallet,
  lightning: Lightning,
  wifi: WifiHigh,
  buildings: Buildings,
  house: HouseSimple,
  bank: Bank,
  "credit-card": CreditCard,
  shield: Shield,
  "shopping-cart": ShoppingCartSimple,
  barbell: Barbell,
  car: Car,
  television: Television,
  "dots-three": DotsThree,
  "piggy-bank": PiggyBank,
  "chart-line": ChartLine,
  "currency-btc": CurrencyBtc,
  "trend-up": TrendUp,
};

interface CategoryIconProps {
  icon: string | null;
  className?: string;
}

export function CategoryIcon({ icon, className }: CategoryIconProps) {
  const IconComponent = (icon && CATEGORY_ICONS[icon]) || DotsThree;

  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center",
        "rounded-md border border-border bg-muted/30",
        className,
      )}
      aria-hidden
    >
      <IconComponent size={18} weight="regular" />
    </span>
  );
}
