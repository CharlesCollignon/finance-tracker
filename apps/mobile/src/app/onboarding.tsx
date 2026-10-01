import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { CURRENCY_LABELS, type CurrencyCode } from "@finance/core/constants";
import { groupCategoriesByType } from "@finance/core/categories";
import type { Category } from "@finance/core/types/database";

import { ConnectBankSheet } from "@/components/bank/ConnectBankSheet";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Logo } from "@/components/Logo";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useBankState } from "@/hooks/useBankState";
import { useRefreshable } from "@/hooks/useRefreshable";
import { shouldInvite } from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useOnboarding } from "@/providers/OnboardingProvider";
import { upsertRecurringTemplate } from "@/lib/mutations";
import { getCategories } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const CURRENCIES: CurrencyCode[] = ["EUR", "USD"];

type Step = "currency" | "income" | "recurring" | "bank";

/**
 * The bank step sits last and only where connecting one is possible, as on
 * the web: after typing a charge or two by hand is when "let your bank do
 * this" means something. There is no "done" step: the last one finishes, as
 * on the web, and the meter counted a step nobody saw.
 */
function stepsFor(offerBank: boolean): Step[] {
  return offerBank
    ? ["currency", "income", "recurring", "bank"]
    : ["currency", "income", "recurring"];
}

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
  const locale = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const { toast } = useToast();
  const { markComplete } = useOnboarding();
  const colors = useThemeColors();

  /*
   * The steps walked so far, so Back returns to the one before rather than
   * to a fixed predecessor, whichever way the reader came. The web keeps the same stack in
   * the browser's history; here it is state, and Android's back button walks
   * it too.
   */
  const [history, setHistory] = useState<Step[]>(["currency"]);
  const step = history[history.length - 1]!;
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

  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const groups = useMemo(
    () => groupCategoriesByType(categories, { locale }),
    [categories, locale],
  );
  const incomeCategory = groups.find((g) => g.type === "income")?.categories[0];
  const expenseCategories =
    groups.find((g) => g.type === "expense")?.categories ?? [];

  const { bank } = useBankState();
  const offerBank = bank !== null && shouldInvite("welcome", bank);
  const stepOrder = stepsFor(offerBank);
  const stepIndex = stepOrder.indexOf(step);

  function goTo(next: Step) {
    setHistory((walked) => [...walked, next]);
  }

  function goBack() {
    setHistory((walked) => (walked.length > 1 ? walked.slice(0, -1) : walked));
  }

  const canGoBack = history.length > 1;
  useEffect(() => {
    if (!canGoBack) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        goBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [canGoBack]);
  const [bankOpen, setBankOpen] = useState(false);

  async function finish(to: Href = "/") {
    // Update shared state before navigating, or the navigator still reads
    // "incomplete" and sends us straight back here.
    await markComplete();
    router.replace(to);
  }

  /** What follows the charges: the bank step where there is one. */
  function afterCharges() {
    if (offerBank) {
      goTo("bank");
    } else {
      void finish();
    }
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

  /** Continue from the income step, keeping an amount that was typed. */
  async function handleIncome() {
    if (!incomeCategory || !incomeAmount.trim()) {
      goTo("recurring");
      return;
    }
    setPending(true);
    const ok = await saveMonthly(incomeCategory.id, incomeAmount, incomeDay);
    setPending(false);
    if (ok) {
      toast(t("onboarding.incomeAdded"), "success");
      goTo("recurring");
    }
  }

  /** Save the charge on screen, and stay here so another can be added. */
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
      toast(t("onboarding.templateAdded", { name: category.name }), "success");
    }
  }

  /**
   * Continue from the charges step, keeping a charge that was filled in but
   * never submitted with "Add this one" — as the web does. It used to be
   * dropped without a word.
   */
  async function handleRecurringContinue() {
    const category = expenseCategories.find((c) => c.id === expenseName);
    if (!category || !expenseAmount.trim()) {
      afterCharges();
      return;
    }
    setPending(true);
    const ok = await saveMonthly(category.id, expenseAmount, expenseDay);
    setPending(false);
    if (ok) {
      setAdded((count) => count + 1);
      toast(t("onboarding.templateAdded", { name: category.name }), "success");
      afterCharges();
    }
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
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t("onboarding.progress")}
          accessibilityValue={{
            min: 1,
            max: stepOrder.length,
            now: stepIndex + 1,
          }}
          className="flex-row justify-center gap-1.5 pt-2"
        >
          {stepOrder.map((value, index) => (
            <View
              key={value}
              className={cn(
                "h-1 w-10 rounded-full",
                // Behind you in the foreground, ahead in the hairline: a
                // meter is a measurement, not something to decide on.
                index <= stepIndex ? "bg-foreground" : "bg-hairline-strong",
              )}
            />
          ))}
        </View>

        {/* One Back control for the whole wizard, absent on the first step,
            where there is nothing behind it. Always the same height, so the
            step below does not jump when it appears. */}
        <View className="h-11 flex-row items-center">
          {canGoBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.back")}
              disabled={pending}
              hitSlop={8}
              onPress={() => {
                void hapticLight();
                goBack();
              }}
              className="h-11 flex-row items-center gap-1 rounded-control pr-3"
              style={pending ? { opacity: 0.5 } : undefined}
            >
              <Ionicons
                name="chevron-back"
                size={ICON.sm}
                color={colors.foreground}
              />
              <Text className="text-sm font-medium">
                {t("onboarding.back")}
              </Text>
            </Pressable>
          ) : null}
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
              </Text>
            </View>

            <Card bezel innerClassName="gap-3 p-5">
              <Text className="text-base font-semibold">
                {t("onboarding.currencyTitle")}
              </Text>
              <Text variant="muted" className="text-sm">
                {t("onboarding.currencyBody")}
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
                        "flex-1 rounded-control border px-4 py-3",
                        selected
                          ? "border-foreground bg-secondary"
                          : "border-border bg-background",
                      )}
                    >
                      <Text className="text-center text-sm font-semibold">
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
              onPress={() => goTo("income")}
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
              {/* Continue whatever is typed, as on the web; the label says
                  when continuing also saves. */}
              <Button
                label={
                  pending
                    ? t("onboarding.saving")
                    : incomeAmount.trim()
                      ? t("onboarding.addIncome")
                      : t("onboarding.continue")
                }
                size="lg"
                disabled={pending}
                onPress={() => {
                  void handleIncome();
                }}
              />
              <Button
                label={t("onboarding.skipForNow")}
                variant="ghost"
                disabled={pending}
                onPress={() => goTo("recurring")}
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
              <Text variant="muted">{t("onboarding.expensesBody")}</Text>
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
                          ? "border-foreground bg-secondary"
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
                label={
                  pending
                    ? t("onboarding.saving")
                    : offerBank
                      ? t("onboarding.continue")
                      : t("removal.onboardingFinish")
                }
                size="lg"
                disabled={pending}
                onPress={() => {
                  void handleRecurringContinue();
                }}
              />
              <Button
                label={t("onboarding.skipForNow")}
                variant="ghost"
                disabled={pending}
                onPress={afterCharges}
              />
            </View>
          </FadeIn>
        ) : null}

        {step === "bank" ? (
          <FadeIn className="gap-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold">
                {t("bankConnect.inviteWelcome")}
              </Text>
              <Text variant="muted">{t("bankConnect.notConnectedBody")}</Text>
            </View>

            <Card bezel innerClassName="gap-2 p-5">
              <Text className="text-sm">{t("bankConnect.factReadOnly")}</Text>
              <Text variant="muted" className="text-sm">
                {t("bankConnect.priceNote")}
              </Text>
            </Card>

            <View className="gap-2">
              <Button
                label={t("bankConnect.sheetTitle")}
                size="lg"
                onPress={() => setBankOpen(true)}
              />
              <Button
                label={t("onboarding.skipForNow")}
                variant="ghost"
                onPress={() => {
                  void finish();
                }}
              />
            </View>

            <ConnectBankSheet
              open={bankOpen}
              onOpenChange={setBankOpen}
              onConnected={() => {
                toast(t("bankConnect.connected"), "success");
                // Setup ends on the Bank screen, where the history comes
                // in, rather than on a Bearing still waiting for it.
                void finish("/bank" as Href);
              }}
            />
          </FadeIn>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
