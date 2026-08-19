"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Archive,
  ArrowCounterClockwise,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { Badge } from "@/components/retroui/Badge";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { Text } from "@/components/retroui/Text";
import { FormLabel } from "@/components/layout/FormLabel";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/layout/ToastProvider";
import {
  CategoryIcon,
  CATEGORY_ICONS,
} from "@/components/finance/CategoryIcon";
import {
  deleteCategory,
  setCategoryArchived,
  upsertCategory,
} from "@/lib/actions/categories";
import { CATEGORY_TYPE_ORDER } from "@finance/core/categories";
import { CATEGORY_TYPE_LABELS } from "@finance/core/category-styles";
import type { Category, CategoryType } from "@finance/core/types/database";
import { cn } from "@/lib/utils";

const ICON_KEYS = Object.keys(CATEGORY_ICONS);

interface CategoriesViewProps {
  categories: Category[];
}

export function CategoriesView({ categories }: CategoriesViewProps) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = CATEGORY_TYPE_ORDER.map((type) => ({
    type,
    label: CATEGORY_TYPE_LABELS[type],
    categories: categories.filter((cat) => cat.type === type),
  })).filter((group) => group.categories.length > 0);

  function handleArchiveToggle(category: Category) {
    startTransition(async () => {
      const result = await setCategoryArchived(category.id, !category.archived);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(
          category.archived ? "Category restored" : "Category archived",
          "success",
        );
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategory(id);
      setConfirmDeleteId(null);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast("Category deleted", "success");
      }
    });
  }

  return (
    <>
      <PageHeader title="Categories" />

      <PageContainer className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Categories organise your transactions and recurring items. Archived
          categories keep their history but no longer appear when adding
          entries.
        </p>

        <div className="flex md:justify-end">
          <Button
            variant="pill"
            size="lg"
            className="w-full md:w-auto md:min-w-[14rem]"
            onClick={() => setFormOpen(true)}
          >
            Add category
            <ButtonNub>
              <Plus size={16} weight="bold" />
            </ButtonNub>
          </Button>
        </div>

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
                        className="h-10 w-10 rounded-[13px] border-0 bg-muted"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">
                            {category.name}
                          </p>
                          {category.type === "investment" &&
                            category.counts_toward_summary === false && (
                              <Badge size="sm" variant="outline">
                                Tracking
                              </Badge>
                            )}
                          {category.archived && (
                            <Badge size="sm" variant="outline">
                              Archived
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
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 min-w-[4.5rem]"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
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
                            aria-label={`Edit ${category.name}`}
                          >
                            <PencilSimple size={18} weight="light" />
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
                                ? `Restore ${category.name}`
                                : `Archive ${category.name}`
                            }
                          >
                            {category.archived ? (
                              <ArrowCounterClockwise size={18} weight="light" />
                            ) : (
                              <Archive size={18} weight="light" />
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
                            aria-label={`Delete ${category.name}`}
                          >
                            <Trash size={18} weight="light" />
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
  const { toast } = useToast();
  const isEditing = category !== null;
  const [state, action, pending] = useActionState(upsertCategory, {});
  const [type, setType] = useState<CategoryType>(category?.type ?? "expense");
  const [icon, setIcon] = useState<string>(category?.icon ?? "dots-three");
  const [countsTowardSummary, setCountsTowardSummary] = useState(
    category?.counts_toward_summary !== false,
  );

  useEffect(() => {
    if (state.success) {
      toast("Category saved", "success");
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, onOpenChange, toast]);

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit category" : "Add category"}
    >
      <form action={action} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="icon" value={icon} />
        <input
          type="hidden"
          name="countsTowardSummary"
          value={
            type === "investment" && !countsTowardSummary ? "false" : "true"
          }
        />

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="category-name">Name</FormLabel>
          <Input
            id="category-name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={category?.name ?? ""}
            className="text-base"
            placeholder="e.g. Groceries"
          />
        </div>

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="category-type">Type</FormLabel>
          <select
            id="category-type"
            name="type"
            required
            value={type}
            onChange={(event) => setType(event.target.value as CategoryType)}
            className={cn(
              "h-11 w-full rounded border border-border bg-background",
              "px-3 text-base text-foreground",
            )}
          >
            {CATEGORY_TYPE_ORDER.map((option) => (
              <option key={option} value={option}>
                {CATEGORY_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        {type === "investment" && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={countsTowardSummary}
              onChange={(event) => setCountsTowardSummary(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              Counts toward monthly budget
              <span className="block text-muted-foreground">
                Untick for wallet DCA tracked outside the budget (e.g. buys
                funded by broker transfers).
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="category-icon">Icon</FormLabel>
          <div
            id="category-icon"
            role="radiogroup"
            aria-label="Category icon"
            className="grid grid-cols-6 gap-2"
          >
            {ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={icon === key}
                aria-label={key}
                onClick={() => setIcon(key)}
                className={cn(
                  "flex h-11 items-center justify-center rounded-xl border",
                  icon === key
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                <CategoryIcon
                  icon={key}
                  className="h-7 w-7 border-0 bg-transparent"
                />
              </button>
            ))}
          </div>
        </div>

        {state.error && (
          <Text className="text-sm text-destructive">{state.error}</Text>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save category"}
        </Button>
      </form>
    </MobileSheet>
  );
}
