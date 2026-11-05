"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowRight,
  Funnel,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonNub } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { Switch } from "@/components/ui/Switch";
import { KIND_INK, KindSwitch } from "@/components/finance/add/parts";
import {
  SHEET_FIELD,
  SheetField,
  SheetGlow,
  SheetSave,
} from "@/components/finance/sheet/entry-sheet";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/layout/ToastProvider";
import { useDeletedToast } from "@/lib/use-deleted-toast";
import {
  CategoryGlyph,
  CategoryIcon,
  CATEGORY_ICONS,
} from "@/components/finance/CategoryIcon";
import {
  deleteCategory,
  setCategoryArchived,
  upsertCategory,
} from "@/lib/actions/categories";
import { CATEGORY_TYPE_ORDER } from "@finance/core/categories";
import { categoryTypeLabels } from "@finance/core/category-styles";
import type { Category, CategoryType } from "@finance/core/types/database";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
import type { FormState } from "@finance/core/action-result";

const ICON_KEYS = Object.keys(CATEGORY_ICONS);

interface CategoriesViewProps {
  categories: Category[];
}

/**
 * What it means that this category does not count toward the month.
 *
 * The flag does something different, and differently important, for each
 * type — and until now only the investment case was visible. That left a
 * savings pair like "Savings account" and "From savings" looking identical in
 * the list, when one adds to what was set aside and the other subtracts from
 * it. The direction lives in the checkbox, not in the name someone typed, so
 * the list has to show it.
 *
 * Null for a category that counts normally, and for expenses, which cannot
 * carry the flag at all.
 */
function notCountingKey(category: {
  type: CategoryType;
  counts_toward_summary: boolean;
}): Key | null {
  if (category.counts_toward_summary !== false) {
    return null;
  }
  switch (category.type) {
    case "investment":
      // Bought inside a wallet with money that already left as a transfer.
      return "categories.notCountingInvestment";
    case "savings":
      return "categories.notCountingSavings";
    case "income":
      return "categories.notCountingIncome";
    default:
      return null;
  }
}

export function CategoriesView({ categories }: CategoriesViewProps) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const toastDeleted = useDeletedToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = CATEGORY_TYPE_ORDER.map((type) => ({
    type,
    label: categoryTypeLabels(locale)[type],
    categories: categories.filter((cat) => cat.type === type),
  })).filter((group) => group.categories.length > 0);

  function handleArchiveToggle(category: Category) {
    startTransition(async () => {
      const result = await setCategoryArchived(category.id, !category.archived);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(
          category.archived
            ? t("categories.restoredToast")
            : t("categories.archivedToast"),
          "success",
        );
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategory(id);
      setConfirmDeleteId(null);
      if (!result.success) {
        toast(result.error, "error");
      } else {
        toastDeleted(t("categories.deleted"), result.undo);
      }
    });
  }

  return (
    <>
      <PageHeader titleKey="pages.categories" />

      <PageContainer className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("categories.blurb")}</p>

        <div className="flex md:justify-end">
          <Button
            variant="pill"
            size="lg"
            className="w-full md:w-auto md:min-w-[14rem]"
            onClick={() => setFormOpen(true)}
          >
            {t("categories.addCategory")}
            <ButtonNub>
              <Plus size={ICON.md} weight="bold" />
            </ButtonNub>
          </Button>
        </div>

        {/* The rules a person writes for filing a line (077): the words
            they decided, and where they go. */}
        <Link
          href="/rules"
          className="flex items-center gap-3 rounded-control border border-border px-4 py-3 transition-colors duration-hover hover:bg-muted/40"
        >
          <Funnel size={ICON.md} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t("rules.link")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("rules.linkHint")}
            </span>
          </span>
          <ArrowRight
            size={ICON.sm}
            className="shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Link>

        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.type}>
              <h2 className="mb-2 font-head text-sm uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <Card.Bezel innerClassName="p-2">
                <ul className="flex flex-col divide-y divide-border">
                  {group.categories.map((category) => (
                    <li
                      key={category.id}
                      className={cn(
                        "flex w-full items-center gap-3 px-2 py-3 sm:py-3.5",
                        category.archived && "opacity-60",
                      )}
                    >
                      <CategoryIcon
                        icon={category.icon}
                        className="h-10 w-10 rounded-control border-0 bg-muted"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">
                            {category.name}
                          </p>
                          {notCountingKey(category) ? (
                            <Badge size="sm" variant="outline">
                              {t(notCountingKey(category)!)}
                            </Badge>
                          ) : null}
                          {category.archived && (
                            <Badge size="sm" variant="outline">
                              {t("categories.archived")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {confirmDeleteId === category.id ? (
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 min-w-[4.5rem] border-destructive text-destructive"
                            onClick={() => handleDelete(category.id)}
                            disabled={pending}
                          >
                            {t("categories.confirmDelete")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 min-w-[4.5rem]"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditCategory(category)}
                            className={cn(
                              "flex h-11 w-11 items-center justify-center",
                              "rounded-full border border-border hover:bg-accent",
                            )}
                            aria-label={t("categories.editNamed", {
                              name: category.name,
                            })}
                          >
                            <PencilSimple size={ICON.lg} weight="light" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveToggle(category)}
                            disabled={pending}
                            className={cn(
                              "flex h-11 w-11 items-center justify-center",
                              "rounded-full border border-border hover:bg-accent",
                            )}
                            aria-label={
                              category.archived
                                ? t("categories.restoreNamed", {
                                    name: category.name,
                                  })
                                : t("categories.archiveNamed", {
                                    name: category.name,
                                  })
                            }
                          >
                            {category.archived ? (
                              <ArrowCounterClockwise
                                size={ICON.lg}
                                weight="light"
                              />
                            ) : (
                              <Archive size={ICON.lg} weight="light" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(category.id)}
                            className={cn(
                              "flex h-11 w-11 items-center justify-center",
                              "rounded-full border border-border",
                              "hover:bg-destructive hover:text-destructive-foreground",
                            )}
                            aria-label={t("categories.deleteNamed", {
                              name: category.name,
                            })}
                          >
                            <Trash size={ICON.lg} weight="light" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card.Bezel>
            </section>
          ))}
        </div>
      </PageContainer>

      {formOpen && (
        <CategoryFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          category={null}
        />
      )}

      {editCategory && (
        <CategoryFormSheet
          key={editCategory.id}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditCategory(null);
            }
          }}
          category={editCategory}
        />
      )}
    </>
  );
}

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

function CategoryFormSheet({
  open,
  onOpenChange,
  category,
}: CategoryFormSheetProps) {
  const t = useT();
  const { toast } = useToast();
  const isEditing = category !== null;
  const [state, action, pending] = useActionState<FormState, FormData>(
    upsertCategory,
    {},
  );
  const [type, setType] = useState<CategoryType>(category?.type ?? "expense");
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState<string>(category?.icon ?? "dots-three");
  const [countsTowardSummary, setCountsTowardSummary] = useState(
    category?.counts_toward_summary !== false,
  );

  useEffect(() => {
    if (state.success) {
      toast(t("categories.saved"), "success");
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, onOpenChange, toast, t]);

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditing ? t("categories.editCategory") : t("categories.addCategory")
      }
    >
      <div className="relative -mx-4 -mt-4 h-0 md:-mx-5 md:-mt-5">
        <SheetGlow ink={KIND_INK[type]} />
      </div>
      <form action={action} className="relative flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="icon" value={icon} />
        <input type="hidden" name="type" value={type} />
        <input
          type="hidden"
          name="countsTowardSummary"
          value={type !== "expense" && !countsTowardSummary ? "false" : "true"}
        />

        {/* What the category will look like wherever it is listed, as it
            is being made: its glyph on a disc in its kind's colour. */}
        <div className="flex flex-col items-center gap-2.5 pb-1 pt-4">
          <span
            className="flex size-16 items-center justify-center rounded-[22px] text-background transition-colors duration-hover"
            style={{ background: KIND_INK[type] }}
          >
            <CategoryGlyph icon={icon} size={ICON.hero} />
          </span>
          <span
            className={cn(
              "max-w-full truncate text-xl font-semibold",
              !name.trim() && "text-muted-foreground",
            )}
          >
            {name.trim() || t("categories.namePlaceholder")}
          </span>
        </div>

        <SheetField label={t("categories.name")} htmlFor="category-name">
          <Input
            id="category-name"
            name="name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={SHEET_FIELD}
            placeholder={t("categories.namePlaceholder")}
          />
        </SheetField>

        <SheetField label={t("categories.type")}>
          <KindSwitch value={type} onChange={setType} />
        </SheetField>

        <SheetField label={t("categories.icon")}>
          {/* A group of toggles, not a radio group: each icon is its own
              tab stop, and `aria-pressed` says which one is chosen without
              claiming arrow keys the control does not handle. */}
          <div
            id="category-icon"
            role="group"
            aria-label={t("categories.iconPicker")}
            className="grid grid-cols-6 gap-2 sm:grid-cols-9"
          >
            {ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={icon === key}
                aria-label={key}
                onClick={() => setIcon(key)}
                style={
                  icon === key ? { background: KIND_INK[type] } : undefined
                }
                className={cn(
                  "flex h-12 items-center justify-center rounded-2xl transition-[background-color,transform] duration-press active:scale-95",
                  icon === key
                    ? "text-background"
                    : "bg-foreground/[0.06] text-foreground hover:bg-foreground/10",
                )}
              >
                <CategoryGlyph icon={key} />
              </button>
            ))}
          </div>
        </SheetField>

        {type !== "expense" && (
          <div className="flex items-start gap-3 border-t border-border pt-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t("categories.countsTowardBudget")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {type === "income"
                  ? t("categories.countsHintIncome")
                  : type === "savings"
                    ? t("categories.countsHintSavings")
                    : t("categories.countsHintInvestment")}
              </p>
            </div>
            <Switch
              checked={countsTowardSummary}
              onChange={setCountsTowardSummary}
              label={t("categories.countsTowardBudget")}
              className="mt-0.5"
            />
          </div>
        )}

        {state.error && (
          <Text className="text-sm text-destructive">
            {resolveMessage(t, state.error)}
          </Text>
        )}

        <SheetSave
          label={
            pending
              ? t("categories.saving")
              : name.trim()
                ? t("categories.saveCategory")
                : t("entry.gap.name")
          }
          disabled={pending || !name.trim()}
        />
      </form>
    </MobileSheet>
  );
}
