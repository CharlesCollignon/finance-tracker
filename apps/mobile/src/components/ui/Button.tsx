import { Pressable, Text, View, type PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/cn";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "default" | "secondary" | "outline" | "ghost" | "pill";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends PressableProps {
  label: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Trailing icon chip; the web pill puts a nub here. */
  icon?: ComponentProps<typeof Ionicons>["name"];
}

// The rim on the gold variants is not decoration: a gold fill is 1.7:1
// against the light ground, so without it the button's edge disappears.
const CONTAINER: Record<Variant, string> = {
  default: "bg-primary border border-primary-rim rounded-md",
  secondary: "bg-secondary rounded-md",
  outline: "bg-transparent border border-border rounded-md",
  ghost: "bg-transparent rounded-md",
  pill: "bg-primary border border-primary-rim rounded-full",
};

const LABEL: Record<Variant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  pill: "text-primary-foreground",
};

const PADDING: Record<Size, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
  lg: "px-6 py-3",
};

/** Web's scale; vertical padding stays a touch larger for finger targets. */
const LABEL_SIZE: Record<Size, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

export function Button({
  label,
  variant = "default",
  size = "md",
  className,
  icon,
  disabled,
  onPress,
  ...props
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      style={animatedStyle}
      className={cn(
        "flex-row items-center justify-center gap-2",
        CONTAINER[variant],
        // The pill's trailing nub sits inside its own end padding, as on web.
        variant === "pill" && icon ? "py-1.5 pl-5 pr-1.5" : PADDING[size],
        variant !== "pill" || !icon ? PADDING[size] : "",
        disabled && "opacity-50",
        className,
      )}
      onPressIn={() => {
        scale.value = withTiming(0.98, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}
      onPress={(event) => {
        void hapticLight();
        onPress?.(event);
      }}
      {...props}
    >
      <Text className={cn("font-semibold", LABEL[variant], LABEL_SIZE[size])}>
        {label}
      </Text>
      {icon ? (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-black/10">
          <Ionicons name={icon} size={16} color="#171100" />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
