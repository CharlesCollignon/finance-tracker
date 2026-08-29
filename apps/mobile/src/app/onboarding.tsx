import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { CURRENCY_LABELS, type CurrencyCode } from "@finance/core/constants";
import { groupCategoriesByType } from "@finance/core/categories";
import type { Category } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Logo } from "@/components/Logo";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { upsertRecurringTemplate } from "@/lib/mutations";
import { getCategories } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";

const CURRENCIES: CurrencyCode[] = ["EUR", "USD"];

type Step = "currency" | "income" | "recurring" | "done";

const STEP_ORDER: Step[] = ["currency", "income", "recurring", "done"];

/**
 * First-run setup. Currency is required because it changes how every figure in
 * the app reads; the rest is skippable, since forcing setup is a common cause
 * of first-session abandonment and everything here is reachable later.
 *
 * The goal is a dashboard with real numbers in it by the end, rather than a
 * screen of zeros that gives a new user nothing to react to.
 */
export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const { toast } = useToast();
  const { markComplete } = useOnboarding();

  const [step, setStep] = useState<Step>("currency");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDay, setIncomeDay] = useState("1");
  const [expenseName, setExpenseName] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDay, setExpenseDay] = useState("1");
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(0);

  const { data } = useRefreshable(async () => {
    if (!user) {
      return { categories: [] as Category[] };
    }
    return { categories: await getCategories(user.id) };
  }, [user?.id]);

  const categories = data?.categories ?? [];
  const groups = useMemo(() => groupCategoriesByType(categories), [categories]);
  const incomeCategory = groups.find((g) => g.type === "income")?.categories[0];
  const expenseCategories =
    groups.find((g) => g.type === "expense")?.categories ?? [];

  const stepIndex = STEP_ORDER.indexOf(step);

  async function finish() {
    // Update shared state before navigating, or the navigator still reads
    // "incomplete" and sends us straight back here.
    await markComplete();
    router.replace("/");
  }

  async function saveMonthly(
    categoryId: string,
    amount: string,
    dayOfMonth: string,
    description?: string,
  ): Promise<boolean> {
    const result = await upsertRecurringTemplate({
      categoryId,
      amount,
      recurrence: "monthly",
      dayOfMonth,
      pricingType: "fixed",
      active: true,
      ...(description ? { description } : {}),
    });
    if (result.error) {
      toast(result.error, "error");
      return false;
    }
    return true;
  }

  async function handleIncome() {
    if (!incomeCategory || !incomeAmount.trim()) {
      setStep("recurring");
      return;
    }
    setPending(true);
    const ok = await saveMonthly(incomeCategory.id, incomeAmount, incomeDay);
    setPending(false);
    if (ok) {
      toast("Income added", "success");
      setStep("recurring");
    }
  }

  async function handleExpense() {
    const category = expenseCategories.find((c) => c.id === expenseName);
    if (!category || !expenseAmount.trim()) {
      return;
    }
    setPending(true);
    const ok = await saveMonthly(category.id, expenseAmount, expenseDay);
    setPending(false);
    if (ok) {
      setAdded((count) => count + 1);
      setExpenseAmount("");
      setExpenseName(null);
      toast(`${category.name} added`, "success");
    }
  }

  return (
    <Screen
      title="Set up"
      showPrivacyToggle={false}
      showAccountMenu={false}
      showLogo={false}
    >
      <ScrollView
        contentContainerClassName="gap-4 pb-28"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row justify-center gap-1.5 pt-2">
          {STEP_ORDER.slice(0, 3).map((value, index) => (
            <View
              key={value}
              className={cn(
                "h-1 w-10 rounded-full",
                index <= stepIndex ? "bg-primary" : "bg-hairline-strong",
              )}
            />
          ))}
        </View>

        {step === "currency" ? (
          <FadeIn className="gap-6">
            <View className="items-center gap-3">
              <Logo size="hero" />
              <Text className="text-center text-2xl font-bold">
                Welcome to Pluclair
              </Text>
              <Text variant="muted" className="text-center">
                Two minutes now and your dashboard will have real numbers in it
                instead of zeros.
              </Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-base font-semibold">
                Which currency do you think in?
              </Text>
              <Text variant="muted" className="text-sm">
                Every amount in the app is shown this way. You can change it
                later in Profile.
              </Text>
              <View className="mt-1 flex-row gap-2">
                {CURRENCIES.map((code) => {
                  const selected = currency === code;
                  return (
                    <Pressable
                      key={code}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        void hapticLight();
                        setCurrency(code);
                      }}
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-3",
                        selected
                          ? "border-primary bg-primary/15"
                          : "border-border bg-background",
                      )}
                    >
                      <Text
                        className={cn(
                          "text-center text-sm font-semibold",
                          selected && "text-primary-ink",
                        )}
                      >
                        {CURRENCY_LABELS[code]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Button
              label="Continue"
              size="lg"
              onPress={() => setStep("income")}
            />
          </FadeIn>
        ) : null}

        {step === "income" ? (
          <FadeIn className="gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold">What comes in?</Text>
              <Text variant="muted">
                Your monthly income is what everything else is measured against.
                Add it once and it repeats every month.
              </Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-sm font-medium">Monthly amount</Text>
              <Input
                value={incomeAmount}
                onChangeText={setIncomeAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <Text className="mt-1 text-sm font-medium">Day of the month</Text>
              <Input
                value={incomeDay}
                onChangeText={setIncomeDay}
                keyboardType="number-pad"
                placeholder="1"
              />
            </Card>

            <View className="gap-2">
              <Button
                label={pending ? "Saving…" : "Add income"}
                size="lg"
                disabled={pending || !incomeAmount.trim()}
                onPress={handleIncome}
              />
              <Button
                label="Skip for now"
                variant="ghost"
                onPress={() => setStep("recurring")}
              />
            </View>
          </FadeIn>
        ) : null}

        {step === "recurring" ? (
          <FadeIn className="gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold">What goes out?</Text>
              <Text variant="muted">
                Rent, subscriptions, bills — the charges you already know are
                coming. These are what make the forecast useful.
              </Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-sm font-medium">Category</Text>
              <View className="flex-row flex-wrap gap-2">
                {expenseCategories.slice(0, 8).map((category) => {
                  const selected = expenseName === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setExpenseName(category.id)}
                      className={cn(
                        "flex-row items-center gap-2 rounded-full border px-3 py-2",
                        selected
                          ? "border-primary bg-primary/15"
                          : "border-border bg-background",
                      )}
                    >
                      <CategoryIcon icon={category.icon} className="h-6 w-6" />
                      <Text className="text-sm">{category.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="mt-2 text-sm font-medium">Monthly amount</Text>
              <Input
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <Text className="mt-1 text-sm font-medium">Day of the month</Text>
              <Input
                value={expenseDay}
                onChangeText={setExpenseDay}
                keyboardType="number-pad"
                placeholder="1"
              />
              <Button
                label={pending ? "Adding…" : "Add this one"}
                variant="outline"
                disabled={pending || !expenseName || !expenseAmount.trim()}
                onPress={handleExpense}
              />
              {added > 0 ? (
                <Text variant="muted" className="text-center text-xs">
                  {`${added} added — add another or finish below.`}
                </Text>
              ) : null}
            </Card>

            <View className="gap-2">
              <Button
                label="Finish setup"
                size="lg"
                onPress={() => {
                  void finish();
                }}
              />
              <Button
                label="Skip for now"
                variant="ghost"
                onPress={() => {
                  void finish();
                }}
              />
            </View>
          </FadeIn>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
