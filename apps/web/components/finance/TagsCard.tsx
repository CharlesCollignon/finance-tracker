"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { useToast } from "@/components/layout/ToastProvider";
import {
  deleteTag,
  mergeTags,
  renameTag,
  upsertTag,
} from "@/lib/actions/phase4";
import { findRenameConflict, type TagUsage } from "@finance/core/tags";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

type ActionResult = { error?: string; success?: boolean };

type Props = {
  tags: TagUsage[];
  /**
   * `tags.manage`. Off, the card is what it always was: the names and a
   * field to add one. On, each tag is a row that opens rename, merge and
   * delete.
   */
  manage: boolean;
};

/** The Plan page's Tags card. */
export function TagsCard({ tags, manage }: Props) {
  const t = useT();
  const { toast } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, addAction, addPending] = useActionState(
    async (previous: ActionResult, formData: FormData) => {
      const result = await upsertTag(previous, formData);
      if (result.success) {
        toast(t("plan.tagAdded"), "success");
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );

  // The row that opened the editor may be gone (merged, deleted), so focus
  // goes back to the card's heading rather than to nothing.
  function closeEditor() {
    setEditingId(null);
    headingRef.current?.focus();
  }

  return (
    <section className="flex flex-col gap-3 rounded-card p-card border border-border bg-card">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-sm font-medium outline-none"
      >
        {t("plan.tagsHeading")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("plan.tagsBlurb")}</p>

      {tags.length > 0 && manage ? (
        <ul className="flex flex-col divide-y divide-border">
          {tags.map((tag) => {
            const open = editingId === tag.id;
            return (
              <li key={tag.id} className="flex flex-col">
                <div className="flex min-h-14 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tag.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("ledger.entryCount", { count: tag.uses })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(open ? null : tag.id)}
                    aria-expanded={open}
                    aria-label={t("plan.editTagNamed", { name: tag.name })}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center",
                      "rounded-full border border-border hover:bg-accent",
                    )}
                  >
                    <PencilSimple size={ICON.lg} weight="light" />
                  </button>
                </div>
                {open ? (
                  <TagEditor tag={tag} tags={tags} onDone={closeEditor} />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className={cn(
                "rounded-full border border-border bg-muted",
                "px-3 py-1 text-xs font-medium",
              )}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      <form action={addAction} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <FormLabel htmlFor="tag-name">{t("plan.newTag")}</FormLabel>
          <Input id="tag-name" name="name" required maxLength={40} />
        </div>
        <Button type="submit" variant="outline" disabled={addPending}>
          {t("plan.addTag")}
        </Button>
      </form>
    </section>
  );
}

/** Rename, merge or delete one tag, under its row. */
function TagEditor({
  tag,
  tags,
  onDone,
}: {
  tag: TagUsage;
  tags: TagUsage[];
  onDone: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(tag.name);
  const [clash, setClash] = useState<TagUsage | null>(null);
  const [intoId, setIntoId] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const others = tags.filter((other) => other.id !== tag.id);
  const into = others.find((other) => other.id === intoId) ?? null;
  const renameId = `tag-rename-${tag.id}`;
  const mergeId = `tag-merge-${tag.id}`;

  function run(action: () => Promise<ActionResult>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(done, "success");
      onDone();
    });
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = findRenameConflict(tags, tag.id, name);
    if (found) {
      setClash(found);
      return;
    }
    run(() => renameTag(tag.id, name), t("plan.tagRenamed"));
  }

  function merge(target: TagUsage) {
    run(() => mergeTags(tag.id, target.id), t("plan.tagMerged"));
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border pb-4 pt-3">
      <form onSubmit={handleRename} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <FormLabel htmlFor={renameId}>{t("plan.tagName")}</FormLabel>
          <Input
            id={renameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setClash(null);
            }}
            required
            maxLength={40}
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {t("plan.renameTag")}
        </Button>
      </form>

      {clash ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 text-sm"
        >
          <span>{t("plan.tagNameExists", { name: clash.name })}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => merge(clash)}
          >
            {t("plan.mergeIntoNamed", { name: clash.name })}
          </Button>
        </div>
      ) : null}

      {others.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <FormLabel htmlFor={mergeId}>{t("plan.mergeTagInto")}</FormLabel>
            <select
              id={mergeId}
              value={intoId}
              onChange={(event) => setIntoId(event.target.value)}
              aria-describedby={`${mergeId}-hint`}
              className={cn(
                "h-11 w-full rounded-control border border-border",
                "bg-background px-3 text-base",
              )}
            >
              <option value="">{t("plan.chooseTag")}</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending || into === null}
            onClick={() => {
              if (into) {
                merge(into);
              }
            }}
          >
            {t("plan.mergeTag")}
          </Button>
          <p
            id={`${mergeId}-hint`}
            className="w-full text-xs text-muted-foreground"
          >
            {t("plan.mergeTagHint", { name: tag.name })}
          </p>
        </div>
      ) : null}

      {confirmingDelete ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {tag.uses === 0
              ? t("plan.deleteTagUnused")
              : t("plan.deleteTagUses", { count: tag.uses })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive"
              disabled={pending}
              onClick={() => run(() => deleteTag(tag.id), t("plan.tagDeleted"))}
            >
              {t("plan.confirmDeleteTag")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingDelete(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="link"
            className="text-destructive"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash size={ICON.md} weight="light" className="mr-1.5" />
            {t("plan.deleteTag")}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            {t("plan.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
