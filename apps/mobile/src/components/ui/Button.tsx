import { Pressable, Text, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/cn";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "default" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends PressableProps {
  label: string;
  variant?: Variant;
  size?: Size;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  default: "bg-primary rounded-md",
  secondary: "bg-secondary rounded-md",
  outline: "bg-transparent border border-border rounded-md",
  ghost: "bg-transparent rounded-md",
};

const LABEL: Record<Variant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
};

const PADDING: Record<Size, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
  lg: "px-6 py-3.5",
};

const LABEL_SIZE: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  label,
  variant = "default",
  size = "md",
  className,
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
        "items-center justify-center",
        CONTAINER[variant],
        PADDING[size],
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
    </AnimatedPressable>
  );
}
