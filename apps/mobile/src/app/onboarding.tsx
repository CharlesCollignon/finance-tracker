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
import { upsertBudget, upsertRecurringTemplate } from "@/lib/mutations";
import { getCategories } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useT } from "@/providers/LocaleProvider";

const CURRENCIES: CurrencyCode[] = ["EUR", "USD"];

type Step = "currency" | "income" | "recurring" | "cap" | "done";

const STEP_ORDER: Step[] = ["currency", "income", "recurring", "cap", "done"];

/**
 * First-run setup. Currency is required because it changes how every figure in
 * the app reads; the rest is skippable, since forcing setup is a common cause
 * of first-session abandonment and everything here is reachable later.
 *
 * The goal is a dashboard with real numbers in it by the end, rather than a
 * screen of zeros that gives a new user nothing to react to.
 */
export default function OnboardingScreen() {
  const t = useT();
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
  const [capCategory, setCapCategory] = useState<string | null>(null);
  const [capAmount, setCapAmount] = useState("");

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
      toast(t("onboarding.incomeAdded"), "success");
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

  /**
   * One spending cap, so the dashboard's rings have something to draw.
   * Without this every new user's dashboard is half empty, which reads as a
   * feature that does not work rather than one not set up yet.
   */
  async function handleCap() {
    if (!capCategory || !capAmount.trim()) {
      await finish();
      return;
    }
    setPending(true);
    const result = await upsertBudget({
      amount: Number(capAmount),
      categoryId: capCategory,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    await finish();
  }

  return (
    <Screen
      title={t("common.setUp")}
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
          {STEP_ORDER.slice(0, 4).map((value, index) => (
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
                {t("onboarding.welcomeTitle")}
              </Text>
              <Text variant="muted" className="text-center">
                {t("onboarding.welcomeBody")}
                instead of zeros.
              </Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-base font-semibold">
                {t("onboarding.currencyTitle")}
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
              label={t("onboarding.continue")}
              size="lg"
              onPress={() => setStep("income")}
            />
          </FadeIn>
        ) : null}

        {step === "income" ? (
          <FadeIn className="gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold">
                {t("onboarding.incomeTitle")}
              </Text>
              <Text variant="muted">{t("onboarding.incomeBody")}</Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-sm font-medium">
                {t("onboarding.monthlyAmount")}
              </Text>
              <Input
                value={incomeAmount}
                onChangeText={setIncomeAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <Text className="mt-1 text-sm font-medium">
                {t("onboarding.dayOfMonth")}
              </Text>
              <Input
                value={incomeDay}
                onChangeText={setIncomeDay}
                keyboardType="number-pad"
                placeholder="1"
              />
            </Card>

            <View className="gap-2">
              <Button
                label={
                  pending ? t("onboarding.saving") : t("onboarding.addIncome")
                }
                size="lg"
                disabled={pending || !incomeAmount.trim()}
                onPress={handleIncome}
              />
              <Button
                label={t("onboarding.skipForNow")}
                variant="ghost"
                onPress={() => setStep("recurring")}
              />
            </View>
          </FadeIn>
        ) : null}

        {step === "recurring" ? (
          <FadeIn className="gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold">
                {t("onboarding.expensesTitle")}
              </Text>
              <Text variant="muted">
                {t("onboarding.expensesBody")}
                coming. These are what make the forecast useful.
              </Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-sm font-medium">
                {t("onboarding.category")}
              </Text>
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

              <Text className="mt-2 text-sm font-medium">
                {t("onboarding.monthlyAmount")}
              </Text>
              <Input
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <Text className="mt-1 text-sm font-medium">
                {t("onboarding.dayOfMonth")}
              </Text>
              <Input
                value={expenseDay}
                onChangeText={setExpenseDay}
                keyboardType="number-pad"
                placeholder="1"
              />
              <Button
                label={
                  pending ? t("onboarding.adding") : t("onboarding.addThisOne")
                }
                variant="outline"
                disabled={pending || !expenseName || !expenseAmount.trim()}
                onPress={handleExpense}
              />
              {added > 0 ? (
                <Text variant="muted" className="text-center text-xs">
                  {t("onboarding.addedCount", { count: added })}
                </Text>
              ) : null}
            </Card>

            <View className="gap-2">
              <Button
                label={t("onboarding.continue")}
                size="lg"
                onPress={() => setStep("cap")}
              />
              <Button
                label={t("onboarding.skipForNow")}
                variant="ghost"
                onPress={() => setStep("cap")}
              />
            </View>
          </FadeIn>
        ) : null}

        {step === "cap" ? (
          <FadeIn className="gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold">
                {t("onboarding.capTitle")}
              </Text>
              <Text variant="muted">{t("onboarding.capBody")}</Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-sm font-medium">
                {t("onboarding.category")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {expenseCategories.slice(0, 8).map((category) => {
                  const selected = capCategory === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        void hapticLight();
                        setCapCategory(category.id);
                      }}
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

              <Text className="mt-2 text-sm font-medium">
                {t("onboarding.monthlyCap")}
              </Text>
              <Input
                value={capAmount}
                onChangeText={setCapAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </Card>

            <View className="gap-2">
              <Button
                label={
                  pending
                    ? t("onboarding.saving")
                    : t("onboarding.setCapAndFinish")
                }
                size="lg"
                disabled={pending || !capCategory || !capAmount.trim()}
                onPress={() => {
                  void handleCap();
                }}
              />
              <Button
                label={t("onboarding.skipForNow")}
                variant="ghost"
                disabled={pending}
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
