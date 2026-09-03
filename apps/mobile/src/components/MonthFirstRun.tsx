import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useThemeColors } from "@/theme/useThemeColors";

interface Step {
  n: number;
  title: string;
  body: string;
  /**
   * Plain string, cast at the push site. The generated route union does not
   * cover the screens outside the tab group, which is why every other push to
   * them in this app is written the same way.
   */
  href: string | null;
  action: string | null;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: "Name what your money is for",
    body: "Rent, groceries, salary, savings. Six or seven is plenty to start.",
    href: "/categories",
    action: "Categories",
  },
  {
    n: 2,
    title: "Add what you already know repeats",
    body: "Rent, a subscription, the transfer into savings. Each one only has to be entered once.",
    href: "/recurring",
    action: "Plan",
  },
  {
    n: 3,
    title: "Then this screen fills itself in",
    body: "Every month is written from what repeats, and you correct the difference rather than typing it all out.",
    href: null,
    action: null,
  },
];

/**
 * The screen a brand-new account actually lands on.
 *
 * It used to be the standing card reporting "Left in September — 0 €" over
 * two more zeros: a correct answer to a question nobody asked, which teaches
 * the reader the app has nothing for them. The guided setup exists, but only
 * in the seconds after signing up — anyone who skipped it, or who signed in
 * later on another device, never saw it again.
 *
 * The steps are numbered because they genuinely are a sequence: the second
 * cannot be done before the first, and the third happens on its own once the
 * other two are.
 */
export function MonthFirstRun() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <Card bezel innerClassName="gap-6 p-5">
      <View className="gap-1.5">
        <Text className="text-xl font-semibold">
          Let&apos;s get the month started
        </Text>
        <Text variant="muted" className="text-sm">
          Pluclair works from what repeats. Two things to set up, and it takes
          about a minute.
        </Text>
      </View>

      <View className="gap-4">
        {STEPS.map((step) => (
          <View key={step.n} className="flex-row gap-3">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
              <Text className="text-xs font-medium">{String(step.n)}</Text>
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-sm font-medium">{step.title}</Text>
              <Text variant="muted" className="text-sm">
                {step.body}
              </Text>
              {step.href && step.action ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={step.action}
                  onPress={() => {
                    void hapticLight();
                    router.push(step.href as Href);
                  }}
                  hitSlop={8}
                  className="mt-1 flex-row items-center gap-1 self-start"
                >
                  <Text className="text-sm font-medium text-primary-ink">
                    {step.action}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={colors.primaryInk}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Walk me through the setup"
        onPress={() => {
          void hapticLight();
          router.push("/onboarding" as Href);
        }}
        hitSlop={8}
        className="self-start"
      >
        <Text variant="muted" className="text-sm underline">
          Or walk me through it
        </Text>
      </Pressable>
    </Card>
  );
}
