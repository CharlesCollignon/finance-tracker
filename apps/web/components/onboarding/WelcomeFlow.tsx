"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

const CURRENCIES: CurrencyCode[] = ["EUR", "USD"];

type Step = "currency" | "income" | "recurring" | "cap";

const STEPS: Step[] = ["currency", "income", "recurring", "cap"];

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
 */
export function WelcomeFlow({ categories }: WelcomeFlowProps) {
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

  function finish() {
    router.push("/dashboard");
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

  function handleIncome() {
    if (!incomeCategory || !incomeAmount.trim()) {
      setStep("recurring");
      return;
    }
    startTransition(async () => {
      if (await saveMonthly(incomeCategory.id, incomeAmount, incomeDay)) {
        toast("Income added", "success");
        setStep("recurring");
      }
    });
  }

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
        toast(`${category.name} added`, "success");
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
        aria-label="Setup progress"
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

      {step === "currency" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo />
            <h1 className="font-head text-2xl">Welcome to Pluclair</h1>
            <p className="text-muted-foreground">
              Two minutes now and your dashboard will have real numbers in it
              instead of zeros.
            </p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <h2 className="text-base font-semibold">
              Which currency do you think in?
            </h2>
            <p className="text-sm text-muted-foreground">
              Every amount in the app is shown this way. You can change it later
              in Profile.
            </p>
            <div className="mt-1 flex gap-2">
              {CURRENCIES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={currency === code}
                  onClick={() => setCurrencyPreference(code)}
                  className={cn(
                    "flex-1 rounded-lg border px-4 py-3 text-sm font-semibold",
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

          <Button size="lg" onClick={() => setStep("income")}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === "income" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-head text-2xl">What comes in?</h1>
            <p className="text-muted-foreground">
              Your monthly income is what everything else is measured against.
              Add it once and it repeats every month.
            </p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <FormLabel htmlFor="income-amount">Monthly amount</FormLabel>
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
            <FormLabel htmlFor="income-day">Day of the month</FormLabel>
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
            <Button
              size="lg"
              disabled={pending || !incomeAmount.trim()}
              onClick={handleIncome}
            >
              {pending ? "Saving…" : "Add income"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("recurring")}>
              Skip for now
            </Button>
          </div>
        </div>
      ) : null}

      {step === "recurring" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-head text-2xl">What goes out?</h1>
            <p className="text-muted-foreground">
              Rent, subscriptions, bills — the charges you already know are
              coming. These are what make the forecast useful.
            </p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <span className="text-sm font-medium">Category</span>
            <CategoryChips
              categories={expenseCategories.slice(0, 8)}
              selected={expenseCategory}
              onSelect={setExpenseCategory}
            />

            <FormLabel htmlFor="expense-amount">Monthly amount</FormLabel>
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
            <FormLabel htmlFor="expense-day">Day of the month</FormLabel>
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
              {pending ? "Adding…" : "Add this one"}
            </Button>
            {added > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                {added} added — add another or continue below.
              </p>
            ) : null}
          </Card.Bezel>

          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={() => setStep("cap")}>
              Continue
            </Button>
            <Button variant="ghost" onClick={() => setStep("cap")}>
              Skip for now
            </Button>
          </div>
        </div>
      ) : null}

      {step === "cap" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-head text-2xl">
              What would you rather not overspend?
            </h1>
            <p className="text-muted-foreground">
              Pick one category and a monthly cap. Month will show a ring that
              fills as you spend against it. You can add more under Plan.
            </p>
          </div>

          <Card.Bezel innerClassName="flex flex-col gap-3 p-5">
            <span className="text-sm font-medium">Category</span>
            <CategoryChips
              categories={expenseCategories.slice(0, 8)}
              selected={capCategory}
              onSelect={setCapCategory}
            />
            <FormLabel htmlFor="cap-amount">Monthly cap</FormLabel>
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
              {pending ? "Saving…" : "Set the cap and finish"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={finish}>
              Skip for now
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
