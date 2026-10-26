"use client";

import { useState, useTransition } from "react";
import { Funnel, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import type { FilingDirection, FilingRule } from "@finance/core/filing-rules";
import { resolveMessage } from "@finance/core/i18n/t";
import type { Category } from "@finance/core/types/database";
import { CategoryPicker } from "@/components/finance/CategoryPicker";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/layout/ToastProvider";
import { Button, ButtonNub } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormLabel } from "@/components/ui/FormLabel";
import { Input } from "@/components/ui/Input";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { ChoiceChips } from "@/components/ui/Picker";
import {
  addFilingRule,
  deleteFilingRule,
  updateFilingRule,
} from "@/lib/actions/filing-rules";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

interface RulesViewProps {
  rules: FilingRule[];
  categories: Category[];
}

/** What the form holds: a rule being written, or one being changed. */
interface Draft {
  id: string | null;
  words: string;
  categoryId: string;
  direction: FilingDirection;
}

const NEW_DRAFT: Draft = { id: null, words: "", categoryId: "", direction: "out" };

/**
 * « Règles de rangement »: the rules a person wrote for filing a line
 * (migration 077), the words they decided and where they go, with how many
 * lines each has answered for. Written here or from the review's
 * « Toujours ranger ici »; changed or deleted here. The phone draws the
 * same screen.
 */
export function RulesView({ rules, categories }: RulesViewProps) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const byId = new Map(categories.map((category) => [category.id, category]));

  function save(current: Draft) {
    startTransition(async () => {
      const input = {
        words: current.words,
        categoryId: current.categoryId,
        direction: current.direction,
      };
      const result = current.id
        ? await updateFilingRule(current.id, input)
        : await addFilingRule(input);
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(t(current.id ? "rules.saved" : "rules.added"), "success");
      setDraft(null);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteFilingRule(id);
      setConfirmId(null);
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(t("rules.deleted"), "success");
    });
  }

  return (
    <>
      <PageHeader titleKey="rules.title" />

      <PageContainer className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("rules.intro")}</p>

        <div className="flex md:justify-end">
          <Button
            variant="pill"
            size="lg"
            className="w-full md:w-auto md:min-w-[14rem]"
            onClick={() => setDraft(NEW_DRAFT)}
          >
            {t("rules.add")}
            <ButtonNub>
              <Plus size={ICON.md} weight="bold" />
            </ButtonNub>
          </Button>
        </div>

        {rules.length === 0 ? (
          <EmptyState title={t("rules.empty")} description={t("rules.emptyBody")} />
        ) : (
          <Card.Bezel innerClassName="px-2 py-1">
            <ul className="flex flex-col">
              {rules.map((rule, index) => {
                const category = byId.get(rule.categoryId);
                const confirming = confirmId === rule.id;
                return (
                  <li
                    key={rule.id}
                    className={cn(
                      "flex min-h-16 flex-wrap items-center gap-3 px-2 py-3",
                      index > 0 && "border-t border-border",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Funnel size={ICON.md} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block text-sm font-medium">
                        « {rule.words} »
                        <span className="text-muted-foreground">
                          {" → "}
                          {rule.categoryName}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {rule.direction === "in"
                          ? t("rules.directionIn")
                          : t("rules.directionOut")}
                        {" · "}
                        {rule.appliedCount > 0
                          ? t("rules.applied", { count: rule.appliedCount })
                          : t("rules.appliedNone")}
                        {rule.createdFrom
                          ? ` · ${t("rules.from", { line: rule.createdFrom })}`
                          : ""}
                      </span>
                    </span>
                    {category ? (
                      <CategoryIcon icon={category.icon} className="shrink-0" />
                    ) : null}
                    <span className="flex shrink-0 items-center gap-1">
                      {confirming ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            disabled={pending}
                            onClick={() => remove(rule.id)}
                          >
                            {t("rules.delete")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmId(null)}
                          >
                            {t("common.cancel")}
                          </Button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={t("rules.editNamed", { words: rule.words })}
                            onClick={() =>
                              setDraft({
                                id: rule.id,
                                words: rule.words,
                                categoryId: rule.categoryId,
                                direction: rule.direction,
                              })
                            }
                            className="flex size-11 items-center justify-center rounded-full border border-border transition-colors duration-hover hover:bg-muted"
                          >
                            <PencilSimple size={ICON.md} aria-hidden />
                          </button>
                          <button
                            type="button"
                            aria-label={t("rules.deleteNamed", { words: rule.words })}
                            onClick={() => setConfirmId(rule.id)}
                            className="flex size-11 items-center justify-center rounded-full border border-border transition-colors duration-hover hover:bg-muted"
                          >
                            <Trash size={ICON.md} aria-hidden />
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card.Bezel>
        )}
      </PageContainer>

      <MobileSheet
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
          }
        }}
        title={draft?.id ? t("rules.edit") : t("rules.add")}
      >
        {draft ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              save(draft);
            }}
          >
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="rule-words">{t("rules.words")}</FormLabel>
              <Input
                id="rule-words"
                value={draft.words}
                placeholder={t("rules.wordsPlaceholder")}
                maxLength={80}
                autoFocus
                onChange={(event) =>
                  setDraft({ ...draft, words: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <FormLabel id="rule-direction">{t("rules.direction")}</FormLabel>
              <ChoiceChips<FilingDirection>
                labelledBy="rule-direction"
                options={[
                  { value: "out", label: t("rules.directionOut") },
                  { value: "in", label: t("rules.directionIn") },
                ]}
                value={draft.direction}
                onValueChange={(direction) => setDraft({ ...draft, direction })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="rule-category">{t("rules.category")}</FormLabel>
              <CategoryPicker
                id="rule-category"
                categories={categories}
                value={draft.categoryId}
                onValueChange={(categoryId) => setDraft({ ...draft, categoryId })}
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending || draft.words.trim().length < 2 || !draft.categoryId}
            >
              {pending
                ? draft.id
                  ? t("rules.saving")
                  : t("rules.adding")
                : draft.id
                  ? t("rules.save")
                  : t("rules.add")}
            </Button>
          </form>
        ) : null}
      </MobileSheet>
    </>
  );
}
