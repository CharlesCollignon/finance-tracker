"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { CURRENCY_LABELS, type CurrencyCode } from "@finance/core/constants";
import type { Category } from "@finance/core/types/database";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { FormLabel } from "@/components/layout/FormLabel";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/components/layout/ToastProvider";
import { upsertBudget } from "@/lib/actions/phase4";
import { upsertRecurringTemplate } from "@/lib/actions/finance";
import { setCurrencyPreference, useCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

const CURRENCIES: CurrencyCode[] = ["EUR", "USD"];

type Step = "currency" | "income" | "recurring" | "cap";

const STEPS: Step[] = ["currency", "income", "recurring", "cap"];

/** The query key the step is carried in, and what a history entry remembers. */
const STEP_PARAM = "step";

/** `/welcome?step=income`, keeping anything else already in the query. */
function urlForStep(step: Step): string {
  const params = new URLSearchParams(window.location.search);
  params.set(STEP_PARAM, step);
  return `${window.location.pathname}?${params.toString()}`;
}

interface WelcomeFlowProps {
  categories: Category[];
}

/**
 * First-run setup on the web.
 *
 * Until now this existed only on mobile, so anyone who signed up on a desktop
 * landed on an empty dashboard with nothing to react to. The steps mirror the
 * mobile flow deliberately — the same four questions in the same order — so
 * the two clients teach the app the same way.
 *
 * Everything after the currency is skippable. Forcing setup is a reliable way
 * to lose a first session, and all of it is reachable later.
 *
 * ## Two things about going backwards
 *
 * The step is pushed onto the history stack as `?step=`, through the native
 * History API the Next.js guide documents for exactly this — `pushState`
 * integrates with the router without re-running the route, so the four steps
 * cost no server round trip and, crucially, the typed amounts in this
 * component's state survive the move. It was plain `useState`, which meant the
 * browser's Back button left the wizard altogether from step four: a reader
 * who wanted to correct the currency they had picked thirty seconds earlier
 * was thrown out onto the Bearing with no way back in but the account menu.
 *
 * The URL is seeded with `replaceState` on mount rather than read back on
 * load. A reload has already lost every field, so restarting at the first
 * question is the honest answer, and correcting the URL to say so keeps the
 * address bar from promising a step the screen is not on.
 *
 * `Continue` saves before it advances. It and `Skip for now` used to call the
 * identical handler on the income and charges steps, so someone who filled a
 * category and an amount in and then pressed the primary — the button that
 * looks safe — lost both without being told. Skipping is the one path that
 * discards, and it is the one that says so.
 */
export function WelcomeFlow({ categories }: WelcomeFlowProps) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const currency = useCurrency();

  const [step, setStep] = useState<Step>("currency");
  const [pending, startTransition] = useTransition();

  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDay, setIncomeDay] = useState("1");
  const [expenseCategory, setExpenseCategory] = useState<string | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDay, setExpenseDay] = useState("1");
  const [added, setAdded] = useState(0);
  const [capCategory, setCapCategory] = useState<string | null>(null);
  const [capAmount, setCapAmount] = useState("");

  const incomeCategory = categories.find((c) => c.type === "income") ?? null;
  const expenseCategories = categories.filter((c) => c.type === "expense");
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    window.history.replaceState(
      { welcomeStep: STEPS[0] },
      "",
      urlForStep(STEPS[0]),
    );

    function onPopState(event: PopStateEvent) {
      const remembered = (event.state as { welcomeStep?: Step } | null)
        ?.welcomeStep;
      setStep(remembered && STEPS.includes(remembered) ? remembered : STEPS[0]);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /** Forward one step, leaving a history entry behind to come back to. */
  const goTo = useCallback((next: Step) => {
    setStep(next);
    window.history.pushState({ welcomeStep: next }, "", urlForStep(next));
  }, []);

  /**
   * Back one step, through the history stack rather than around it.
   *
   * Pushing the previous step would work on screen and leave a stack that
   * walks forward again when the user presses Back — the wizard's own control
   * and the browser's would then disagree about which way is back. Every step
   * after the first was arrived at through `goTo`, so the entry behind this
   * one is always the step before it.
   */
  function goBack() {
    window.history.back();
  }

  function finish() {
    router.push("/bearing");
  }

  /** Both actions take FormData, so the wizard builds one rather than
   * duplicating a validated server path just to pass an object. */
  async function saveMonthly(
    categoryId: string,
    amount: string,
    dayOfMonth: string,
  ): Promise<boolean> {
    const form = new FormData();
    form.set("categoryId", categoryId);
    form.set("amount", amount);
    form.set("recurrence", "monthly");
    form.set("dayOfMonth", dayOfMonth);
    form.set("pricingType", "fixed");
    form.set("active", "on");

    const result = await upsertRecurringTemplate({}, form);
    if (result.error) {
      toast(result.error, "error");
      return false;
    }
    return true;
  }

  /** Continue from the income step, keeping an amount that was typed. */
  function handleIncome() {
    if (!incomeCategory || !incomeAmount.trim()) {
      goTo("recurring");
      return;
    }
    startTransition(async () => {
      if (await saveMonthly(incomeCategory.id, incomeAmount, incomeDay)) {
        toast(t("onboarding.incomeAdded"), "success");
        goTo("recurring");
      }
    });
  }

  /** Save the charge on screen, and stay here so another can be added. */
  function handleExpense() {
    const category = expenseCategories.find((c) => c.id === expenseCategory);
    if (!category || !expenseAmount.trim()) {
      return;
    }
    startTransition(async () => {
      if (await saveMonthly(category.id, expenseAmount, expenseDay)) {
        setAdded((count) => count + 1);
        setExpenseAmount("");
        setExpenseCategory(null);
        toast(
          t("onboarding.templateAdded", { name: category.name }),
          "success",
        );
      }
    });
  }

  /**
   * Continue from the charges step, keeping a charge that was filled in but
   * never submitted with "Add this one".
   */
  function handleRecurringContinue() {
    const category = expenseCategories.find((c) => c.id === expenseCategory);
    if (!category || !expenseAmount.trim()) {
      goTo("cap");
      return;
    }
    startTransition(async () => {
      if (await saveMonthly(category.id, expenseAmount, expenseDay)) {
        setAdded((count) => count + 1);
        toast(
          t("onboarding.templateAdded", { name: category.name }),
          "success",
        );
        goTo("cap");
      }
    });
  }

  function handleCap() {
    if (!capCategory || !capAmount.trim()) {
      finish();
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      form.set("categoryId", capCategory);
      form.set("amount", capAmount);

      const result = await upsertBudget({}, form);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      finish();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div
        className="flex justify-center gap-1.5"
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={t("onboarding.progress")}
      >
        {STEPS.map((value, index) => (
          <span
            key={value}
            className={cn(
              "h-1 w-10 rounded-full",
              index <= stepIndex ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>

      {/* One Back control for the whole wizard rather than one per step, and
          absent on the first, where there is nothing behind it but the page
          the reader came in from. */}
      {stepIndex > 0 ? (
        <div className="-mt-2 flex">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            disabled={pending}
            onClick={goBack}
          >
            <CaretLeft size={ICON.sm} weight="bold" />
            {t("onboarding.back")}
          </Button>
        </div>
      ) : null}

      {step === "currency" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo />
            <h1 className="font-head text-2xl">
              {t("onboarding.welcomeTitle")}
            </h1>
            <p className="text-muted-foreground">
              {t("onboarding.welcomeBody")}
            </p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <h2 className="text-base font-semibold">
              {t("onboarding.currencyTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("onboarding.currencyBody")}
            </p>
            <div className="mt-1 flex gap-2">
              {CURRENCIES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={currency === code}
                  onClick={() => setCurrencyPreference(code)}
                  className={cn(
                    "flex-1 rounded-control border px-4 py-3 text-sm font-semibold",
                    currency === code
                      ? "border-primary bg-primary/10 text-primary-ink"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {CURRENCY_LABELS[code]}
                </button>
              ))}
            </div>
          </Card.Bezel>

          <Button size="lg" onClick={() => goTo("income")}>
            {t("onboarding.continue")}
          </Button>
        </div>
      ) : null}

      {step === "income" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-head text-2xl">
              {t("onboarding.incomeTitle")}
            </h1>
            <p className="text-muted-foreground">
              {t("onboarding.incomeBody")}
            </p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <FormLabel htmlFor="income-amount">
              {t("onboarding.monthlyAmount")}
            </FormLabel>
            {/* `0.00` rather than a translated `0,00`: these are
                `type="number"` inputs, which accept the dot form whatever the
                reader's locale, so a comma in the placeholder would teach a
                format the field rejects. The month close's balance field is
                `type="text"` and does carry a translated example. */}
            <Input
              id="income-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={incomeAmount}
              onChange={(event) => setIncomeAmount(event.target.value)}
            />
            <FormLabel htmlFor="income-day">
              {t("onboarding.dayOfMonth")}
            </FormLabel>
            <Input
              id="income-day"
              type="number"
              min="1"
              max="31"
              value={incomeDay}
              onChange={(event) => setIncomeDay(event.target.value)}
            />
          </Card.Bezel>

          <div className="flex flex-col gap-2">
            {/* Saves the amount in the field before it advances, so the only
                button here that throws typing away is the one that says it
                does. It was "Add income", disabled until something was typed,
                which left a reader with nothing to add no forward move but
                the skip — and a reader who had typed one no warning that the
                skip would drop it. */}
            <Button size="lg" disabled={pending} onClick={handleIncome}>
              {pending ? t("onboarding.saving") : t("onboarding.continue")}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => goTo("recurring")}
            >
              {t("onboarding.skipForNow")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "recurring" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-head text-2xl">
              {t("onboarding.expensesTitle")}
            </h1>
            <p className="text-muted-foreground">
              {t("onboarding.expensesBody")}
            </p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <span className="text-sm font-medium">
              {t("onboarding.category")}
            </span>
            <CategoryChips
              categories={expenseCategories.slice(0, 8)}
              selected={expenseCategory}
              onSelect={setExpenseCategory}
            />

            <FormLabel htmlFor="expense-amount">
              {t("onboarding.monthlyAmount")}
            </FormLabel>
            <Input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={expenseAmount}
              onChange={(event) => setExpenseAmount(event.target.value)}
            />
            <FormLabel htmlFor="expense-day">
              {t("onboarding.dayOfMonth")}
            </FormLabel>
            <Input
              id="expense-day"
              type="number"
              min="1"
              max="31"
              value={expenseDay}
              onChange={(event) => setExpenseDay(event.target.value)}
            />
            <Button
              variant="outline"
              disabled={pending || !expenseCategory || !expenseAmount.trim()}
              onClick={handleExpense}
            >
              {pending ? t("onboarding.adding") : t("onboarding.addThisOne")}
            </Button>
            {added > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                {t("onboarding.addedCount", { count: added })}
              </p>
            ) : null}
          </Card.Bezel>

          <div className="flex flex-col gap-2">
            {/* Continue and Skip called the same handler, so a charge filled
                in but never submitted with "Add this one" was lost to
                whichever of the two the reader pressed. Continue now saves it
                first. */}
            <Button
              size="lg"
              disabled={pending}
              onClick={handleRecurringContinue}
            >
              {pending ? t("onboarding.saving") : t("onboarding.continue")}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => goTo("cap")}
            >
              {t("onboarding.skipForNow")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "cap" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-head text-2xl">{t("onboarding.capTitle")}</h1>
            <p className="text-muted-foreground">{t("onboarding.capBody")}</p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <span className="text-sm font-medium">
              {t("onboarding.category")}
            </span>
            <CategoryChips
              categories={expenseCategories.slice(0, 8)}
              selected={capCategory}
              onSelect={setCapCategory}
            />
            <FormLabel htmlFor="cap-amount">
              {t("onboarding.monthlyCap")}
            </FormLabel>
            <Input
              id="cap-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={capAmount}
              onChange={(event) => setCapAmount(event.target.value)}
            />
          </Card.Bezel>

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={pending || !capCategory || !capAmount.trim()}
              onClick={handleCap}
            >
              {pending
                ? t("onboarding.saving")
                : t("onboarding.setCapAndFinish")}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={finish}>
              {t("onboarding.skipForNow")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={selected === category.id}
          onClick={() => onSelect(category.id)}
          className={cn(
            "flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm",
            selected === category.id
              ? "border-primary bg-primary/10 text-primary-ink"
              : "border-border hover:bg-muted",
          )}
        >
          <CategoryIcon icon={category.icon} className="h-4 w-4" />
          {category.name}
        </button>
      ))}
    </div>
  );
}
