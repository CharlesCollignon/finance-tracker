"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from "motion/react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FileArrowUp,
  Warning,
} from "@phosphor-icons/react";
import { formatFullDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import {
  BANK_NAMES,
  isBankId,
  readMappedTable,
  readStatementFile,
  readStatementText,
  statementKey,
  withDirection,
  type Statement,
  type StatementBlock,
  type TableMapping,
} from "@finance/core/statement";
import type { StatementImportInput } from "@finance/core/validations/statements";
import type {
  FileAccount,
  StatementImport as PastImport,
} from "@finance/data/statements";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/layout/ToastProvider";
import { BankGuide } from "@/components/finance/statements/BankGuide";
import { MappingCard } from "@/components/finance/statements/MappingCard";
import {
  initialChoice,
  StatementBlockCard,
  type BlockChoice,
} from "@/components/finance/statements/StatementBlockCard";
import {
  importStatement,
  previewStatement,
  undoStatementImport,
} from "@/lib/actions/statements";
import { ICON } from "@/lib/icon-scale";
import { takeStatementFile } from "@/lib/statements/pending";
import { useLocale, useT } from "@/lib/locale-context";
import type { StatementOutcome } from "@finance/core/validations/statements";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** A statement bigger than this is not one. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** How long an import can be undone, as the server holds it. */
const UNDO_DAYS = 30;

/** How the file came: picked or dropped, or a table pasted. */
type Source = StatementImportInput["source"];

type Stage =
  | { kind: "start" }
  | { kind: "read"; statement: Statement; fileName: string; source: Source }
  | { kind: "done"; added: number; waiting: number; importIds: string[] };

/** What one block sends: its lines, turned if the person said so, on its account. */
function inputFor(
  statement: Statement,
  block: StatementBlock,
  choice: BlockChoice,
  fileName: string,
  source: Source,
): StatementImportInput | null {
  const format = statement.format;
  if (
    format === "pdf" ||
    format === "xls" ||
    format === "image" ||
    format === "unknown"
  ) {
    return null;
  }
  // The engine's lines, as the schema names them; the server checks each.
  const lines = (
    block.signUnknown
      ? withDirection(block, choice.direction).lines
      : block.lines
  ) as StatementImportInput["lines"];
  return {
    account:
      choice.account.kind === "existing"
        ? choice.account
        : {
            kind: "new",
            key: statementKey(block.account),
            label: choice.account.label.trim() || "—",
            bank: statement.bank,
            currency: block.currency,
            role: choice.account.role,
          },
    lines,
    format,
    bank: statement.bank,
    fileName: fileName.slice(0, 200),
    from: block.from,
    to: block.to,
    closing: block.closing,
    source,
  };
}

/**
 * Importing a bank statement, with no bank connection
 * (`docs/plans/STATEMENTS_PLAN.md`, Phase 1): the file the bank gives, as
 * it is, read in the browser (`@finance/core/statement`); one card per
 * account it covers, saying what was understood; the account it is, asked
 * only when the file does not say; what importing would do, from the
 * server, the figures rolling in; one button. After, the transactions are
 * where the bank's would be — the known ones filed, the rest « À vérifier »
 * — and the import can be undone, whole, for a month.
 */
export function StatementImport({
  accounts,
  imports,
}: {
  accounts: FileAccount[];
  imports: PastImport[];
}) {
  const t = useT();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "start" });
  const [choices, setChoices] = useState<BlockChoice[]>([]);
  const [outcomes, setOutcomes] = useState<(StatementOutcome | null)[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function readFile(file: File) {
    setProblem(null);
    if (file.size > MAX_FILE_BYTES) {
      setProblem(t("statements.tooBig"));
      return;
    }
    setBusy(true);
    try {
      const statement = readStatementFile(
        new Uint8Array(await file.arrayBuffer()),
      );
      open(statement, file.name);
    } finally {
      setBusy(false);
    }
  }

  function open(
    statement: Statement,
    fileName: string,
    source: Source = "file",
  ) {
    setChoices(
      statement.blocks.map((block) =>
        initialChoice(
          block,
          statement.bank,
          accounts,
          t("statements.accountMine"),
        ),
      ),
    );
    setOutcomes(statement.blocks.map(() => null));
    setStage({ kind: "read", statement, fileName, source });
  }

  // A file dropped on another page, which opened this one with it.
  useEffect(() => {
    const held = takeStatementFile();
    if (held) {
      // After this commit, not inside it: reading sets the page's state.
      void Promise.resolve().then(() => readFile(held));
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A table copied from the bank's website, pasted anywhere on the page —
  // not into a field being typed in.
  const starting = stage.kind === "start";
  useEffect(() => {
    if (!starting) {
      return;
    }
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) {
        return;
      }
      const html = event.clipboardData?.getData("text/html") ?? "";
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const pasted = /<table[\s>]/i.test(html) ? html : text;
      if (!pasted.trim()) {
        return;
      }
      event.preventDefault();
      open(readStatementText(pasted), "", "paste");
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // `open` is this render's; whether the page is at its start is what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starting]);

  // What importing would do, asked again whenever an answer changes it.
  const reading = stage.kind === "read" ? stage : null;
  useEffect(() => {
    if (!reading || reading.statement.blocks.length === 0) {
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      void Promise.all(
        reading.statement.blocks.map((block, index) => {
          const input = choices[index]
            ? inputFor(
                reading.statement,
                block,
                choices[index]!,
                reading.fileName,
                reading.source,
              )
            : null;
          return input ? previewStatement(input) : Promise.resolve(null);
        }),
      ).then((results) => {
        if (live) {
          setOutcomes(
            results.map((result) => (result?.success ? result : null)),
          );
        }
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [reading, choices]);

  function runImport() {
    if (!reading) {
      return;
    }
    startTransition(async () => {
      let added = 0;
      let waiting = 0;
      const importIds: string[] = [];
      for (const [index, block] of reading.statement.blocks.entries()) {
        const input = inputFor(
          reading.statement,
          block,
          choices[index]!,
          reading.fileName,
          reading.source,
        );
        if (!input) {
          continue;
        }
        const result = await importStatement(input);
        if (!result.success) {
          toast(resolveMessage(t, result.error), "error");
          return;
        }
        added += result.matched + result.filed + result.waiting;
        waiting += result.waiting;
        if (result.importId) {
          importIds.push(result.importId);
        }
      }
      setStage({ kind: "done", added, waiting, importIds });
    });
  }

  function undo(importIds: readonly string[]) {
    startTransition(async () => {
      for (const id of importIds) {
        const result = await undoStatementImport(id);
        if (!result.success) {
          toast(resolveMessage(t, result.error), "error");
          return;
        }
      }
      toast(t("statements.undone"), "success");
      setStage({ kind: "start" });
    });
  }

  const statement = reading?.statement ?? null;
  // Every line already brought, or left out: nothing an import would add.
  const nothingNew =
    outcomes.length > 0 &&
    outcomes.every(
      (outcome) =>
        outcome !== null &&
        outcome.kept &&
        outcome.known + outcome.left >= outcome.total,
    );
  const notHere =
    statement?.problem === "notHere"
      ? statement.format === "pdf"
        ? t("statements.pdf")
        : statement.format === "xls"
          ? t("statements.xls")
          : t("statements.image")
      : null;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <PageHeader titleKey="pages.import">
          <Button
            variant="link"
            size="sm"
            render={
              <Link href="/transactions">
                <ArrowLeft
                  size={ICON.md}
                  className="inline sm:mr-1"
                  aria-hidden
                />
                {/* The arrow alone on a narrow screen, where the page's
                    title needs the room. */}
                <span className="sr-only sm:not-sr-only">
                  {t("nav.ledger")}
                </span>
              </Link>
            }
          />
        </PageHeader>

        <PageContainer className="flex flex-col gap-4">
          <AnimatePresence mode="wait" initial={false}>
            {stage.kind === "start" ? (
              <m.div
                key="start"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.panel / 1000, ease: EASE }}
                className="flex flex-col gap-4"
              >
                <Card.Bezel
                  className="w-full"
                  innerClassName="flex flex-col gap-5 p-6"
                >
                  <div>
                    <h1 className="font-head text-xl">
                      {t("statements.heading")}
                    </h1>
                    <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                      {t("statements.intro")}
                    </p>
                  </div>
                  <m.div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      const file = event.dataTransfer.files[0];
                      if (file) {
                        void readFile(file);
                      }
                    }}
                    animate={{ scale: dragging ? 1.015 : 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-10 text-center transition-colors duration-hover",
                      dragging
                        ? "border-primary bg-primary/5"
                        : "border-border",
                    )}
                  >
                    <m.span
                      animate={{ y: dragging ? -6 : 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 18,
                      }}
                    >
                      <FileArrowUp
                        size={ICON.hero}
                        aria-hidden
                        className="text-muted-foreground"
                      />
                    </m.span>
                    <p className="text-sm font-medium" aria-live="polite">
                      {busy
                        ? t("statements.reading")
                        : dragging
                          ? t("statements.dropping")
                          : t("statements.drop")}
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) {
                          void readFile(file);
                        }
                      }}
                    />
                    <Button onClick={() => fileRef.current?.click()}>
                      {t("statements.choose")}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t("statements.formats")}
                    </p>
                  </m.div>
                  <p className="text-sm text-muted-foreground">
                    {t("statements.pasteHint")}
                  </p>
                  {problem ? (
                    <p
                      role="alert"
                      className="flex items-center gap-2 text-sm text-destructive"
                    >
                      <Warning size={ICON.md} aria-hidden />
                      {problem}
                    </p>
                  ) : null}
                  <BankGuide />
                </Card.Bezel>

                {imports.length > 0 ? (
                  <ImportHistory
                    imports={imports}
                    accounts={accounts}
                    onUndo={(id) => undo([id])}
                    pending={pending}
                  />
                ) : null}
              </m.div>
            ) : null}

            {reading && statement ? (
              <m.div
                key={`read-${reading.fileName}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.panel / 1000, ease: EASE }}
                className="flex flex-col gap-4"
              >
                {statement.problem === "columns" && statement.table ? (
                  <MappingCard
                    table={statement.table}
                    onRead={(mapping: TableMapping) => {
                      const read = readMappedTable(statement.table!, mapping);
                      open(
                        {
                          ...statement,
                          bank: read.bank,
                          blocks: read.blocks,
                          skipped: read.skipped,
                          problem: read.problem,
                          table:
                            read.problem === "columns" ? statement.table : null,
                        },
                        reading.fileName,
                      );
                    }}
                  />
                ) : statement.blocks.length === 0 ? (
                  <Card.Bezel
                    className="w-full"
                    innerClassName="flex flex-col gap-4 p-6"
                  >
                    <p role="alert" className="flex items-start gap-2 text-sm">
                      <Warning
                        size={ICON.md}
                        aria-hidden
                        className="mt-0.5 shrink-0"
                      />
                      {notHere ??
                        (statement.problem === "empty"
                          ? t("statements.empty")
                          : t("statements.unreadable"))}
                    </p>
                    <BankGuide initialBank={statement.bank} />
                  </Card.Bezel>
                ) : (
                  statement.blocks.map((block, index) => (
                    <StatementBlockCard
                      key={index}
                      index={index}
                      block={block}
                      bank={statement.bank}
                      accounts={accounts}
                      choice={choices[index]!}
                      onChoice={(choice) =>
                        setChoices((current) =>
                          current.map((old, at) =>
                            at === index ? choice : old,
                          ),
                        )
                      }
                      outcome={outcomes[index] ?? null}
                    />
                  ))
                )}

                {statement.skipped > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("statements.skipped", { count: statement.skipped })}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setStage({ kind: "start" })}
                  >
                    {t("statements.another")}
                  </Button>
                  {nothingNew ? (
                    <p className="text-sm text-muted-foreground">
                      {t("statements.nothingNew")}
                    </p>
                  ) : statement.blocks.length > 0 ? (
                    <Button onClick={runImport} disabled={pending}>
                      {pending
                        ? t("statements.importing")
                        : t("statements.import")}
                    </Button>
                  ) : null}
                </div>
              </m.div>
            ) : null}

            {stage.kind === "done" ? (
              <m.div
                key="done"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
              >
                <Card.Bezel
                  className="w-full"
                  innerClassName="flex flex-col items-start gap-4 p-6"
                >
                  <m.span
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 14,
                      delay: 0.1,
                    }}
                  >
                    <CheckCircle
                      size={ICON.hero}
                      weight="fill"
                      aria-hidden
                      className="text-success"
                    />
                  </m.span>
                  <div className="flex flex-col gap-1">
                    <h2 className="font-head text-lg">
                      {stage.added > 0
                        ? t("statements.added", { count: stage.added })
                        : t("statements.nothingNew")}
                    </h2>
                    {stage.waiting > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("statements.addedWaiting", { count: stage.waiting })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stage.waiting > 0 ? (
                      <Button
                        render={
                          <Link href="/transactions?review=inbox">
                            {t("statements.review")}
                            <ArrowRight
                              size={ICON.sm}
                              className="ml-1 inline"
                              aria-hidden
                            />
                          </Link>
                        }
                      />
                    ) : null}
                    <Button
                      variant="outline"
                      onClick={() => setStage({ kind: "start" })}
                    >
                      {t("statements.another")}
                    </Button>
                    {stage.importIds.length > 0 ? (
                      <Button
                        variant="ghost"
                        onClick={() => undo(stage.importIds)}
                        disabled={pending}
                      >
                        <ArrowCounterClockwise
                          size={ICON.sm}
                          className="mr-1 inline"
                          aria-hidden
                        />
                        {t("statements.undo")}
                      </Button>
                    ) : null}
                  </div>
                </Card.Bezel>
              </m.div>
            ) : null}
          </AnimatePresence>
        </PageContainer>
      </MotionConfig>
    </LazyMotion>
  );
}

/** The latest imports, each to be undone for a month. */
function ImportHistory({
  imports: past,
  accounts: known,
  onUndo,
  pending: busy,
}: {
  imports: PastImport[];
  accounts: FileAccount[];
  onUndo: (id: string) => void;
  pending: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  // Read once: how old each import is does not need to move while it is read.
  const [now] = useState(() => Date.now());
  return (
    <Card.Bezel className="w-full" innerClassName="flex flex-col gap-3 p-6">
      <h2 className="font-head text-base">{t("statements.history")}</h2>
      <ul className="flex flex-col divide-y divide-border">
        {past.map((item) => {
          const account = known.find(
            (one) => one.providerAccountId === item.providerAccountId,
          );
          const name =
            item.fileName ??
            account?.label ??
            (item.bank && isBankId(item.bank)
              ? BANK_NAMES[item.bank]
              : t("statements.statement"));
          const undoable =
            !item.undoneAt &&
            now - new Date(item.createdAt).getTime() < UNDO_DAYS * 86_400_000;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "truncate text-sm",
                    item.undoneAt && "text-muted-foreground line-through",
                  )}
                >
                  {name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {`${formatFullDate(item.createdAt.slice(0, 10), locale)} · ${
                    item.undoneAt
                      ? t("statements.undoneTag")
                      : t("statements.added", { count: item.linesNew })
                  }`}
                </span>
              </div>
              {undoable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUndo(item.id)}
                  disabled={busy}
                >
                  {t("statements.undo")}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card.Bezel>
  );
}
