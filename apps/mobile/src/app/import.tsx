import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
  ZoomIn,
} from "react-native-reanimated";

import { formatFullDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { DURATION } from "@finance/core/motion";
import {
  BANK_NAMES,
  isBankId,
  readMappedTable,
  readStatementFile,
  statementKey,
  withDirection,
  type Statement,
  type StatementBlock,
} from "@finance/core/statement";
import type {
  StatementImportInput,
  StatementOutcome,
} from "@finance/core/validations/statements";

import { BankGuide } from "@/components/statements/BankGuide";
import { BlockCard, initialChoice, type BlockChoice } from "@/components/statements/BlockCard";
import { MappingCard } from "@/components/statements/MappingCard";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  importStatement,
  previewStatement,
  readFileAccounts,
  readImports,
  undoStatementImport,
} from "@/lib/statements";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** A statement bigger than this is not one. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** How long an import can be undone, as the server holds it. */
const UNDO_DAYS = 30;

type Stage =
  | { kind: "start" }
  | { kind: "read"; statement: Statement; fileName: string }
  | { kind: "done"; added: number; waiting: number; importIds: string[] };

/** What one block sends: its lines, turned if the person said so, on its account. */
function inputFor(
  statement: Statement,
  block: StatementBlock,
  choice: BlockChoice,
  fileName: string,
): StatementImportInput | null {
  const format = statement.format;
  if (format === "pdf" || format === "xls" || format === "image" || format === "unknown") {
    return null;
  }
  // The engine's lines, as the schema names them; the server checks each.
  const lines = (block.signUnknown ? withDirection(block, choice.direction).lines : block.lines) as StatementImportInput["lines"];
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
    source: "file",
  };
}

/**
 * Importing a bank statement on the phone, with no bank connection
 * (`docs/plans/STATEMENTS_PLAN.md`, Phase 1) — the web's import, in the
 * phone's own components: the file the bank gives, as it is, read here;
 * one card per account it covers; the account asked only when the file
 * does not say; what importing would do, from the server; one button. After,
 * the lines are where the bank's would be — the known ones filed, the rest
 * « À vérifier » — and the import can be undone, whole, for a month.
 */
export default function ImportScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const { user } = useAuth();
  const { ownerId } = useOwner();
  const userId = user?.id ?? null;

  const { data: known, onRefresh } = useRefreshable(
    async () => ({
      accounts: userId ? await readFileAccounts(userId) : [],
      imports: ownerId ? await readImports(ownerId) : [],
      readAt: Date.now(),
    }),
    [userId, ownerId],
    { reads: ["transactions", "bank"] },
  );
  const accounts = known?.accounts ?? [];
  const imports = known?.imports ?? [];

  const [stage, setStage] = useState<Stage>({ kind: "start" });
  const [choices, setChoices] = useState<BlockChoice[]>([]);
  const [outcomes, setOutcomes] = useState<(StatementOutcome | null)[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function open(statement: Statement, fileName: string) {
    setChoices(
      statement.blocks.map((block) => initialChoice(block, statement.bank, accounts, t("statements.accountMine"))),
    );
    setOutcomes(statement.blocks.map(() => null));
    setStage({ kind: "read", statement, fileName });
  }

  async function pickFile() {
    setProblem(null);
    const result = await DocumentPicker.getDocumentAsync({
      // Banks give their exports every type and none: the filter stays
      // wide, and the file's content decides what it is.
      type: ["*/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    const asset = result.assets[0];
    if ((asset.size ?? 0) > MAX_FILE_BYTES) {
      setProblem(t("statements.tooBig"));
      return;
    }
    setPending(true);
    try {
      const statement = readStatementFile(new Uint8Array(await new File(asset.uri).arrayBuffer()));
      void hapticLight();
      open(statement, asset.name ?? "");
    } catch {
      setProblem(t("statements.unreadable"));
    } finally {
      setPending(false);
    }
  }

  // What importing would do, asked again whenever an answer changes it.
  const reading = stage.kind === "read" ? stage : null;
  useEffect(() => {
    if (!reading || reading.statement.blocks.length === 0 || !ownerId) {
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      void Promise.all(
        reading.statement.blocks.map((block, index) => {
          const input = choices[index] ? inputFor(reading.statement, block, choices[index]!, reading.fileName) : null;
          return input ? previewStatement(input, ownerId) : Promise.resolve(null);
        }),
      ).then((results) => {
        if (live) {
          setOutcomes(results);
        }
      });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [reading, choices, ownerId]);

  async function runImport() {
    if (!reading || !ownerId) {
      return;
    }
    setPending(true);
    let added = 0;
    let waiting = 0;
    const importIds: string[] = [];
    for (const [index, block] of reading.statement.blocks.entries()) {
      const input = inputFor(reading.statement, block, choices[index]!, reading.fileName);
      if (!input) {
        continue;
      }
      const result = await importStatement(input, ownerId);
      if (!result.ok) {
        setPending(false);
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      added += result.outcome.matched + result.outcome.filed + result.outcome.waiting;
      waiting += result.outcome.waiting;
      if (result.outcome.importId) {
        importIds.push(result.outcome.importId);
      }
    }
    setPending(false);
    void hapticSuccess();
    setStage({ kind: "done", added, waiting, importIds });
    onRefresh();
  }

  async function undo(importIds: readonly string[]) {
    if (!ownerId) {
      return;
    }
    setPending(true);
    for (const id of importIds) {
      const result = await undoStatementImport(id, ownerId);
      if (!result.ok) {
        setPending(false);
        toast(resolveMessage(t, result.error), "error");
        return;
      }
    }
    setPending(false);
    toast(t("statements.undone"), "success");
    setStage({ kind: "start" });
    onRefresh();
  }

  const statement = reading?.statement ?? null;
  const notHere =
    statement?.problem === "notHere"
      ? statement.format === "pdf"
        ? t("statements.pdf")
        : statement.format === "xls"
          ? t("statements.xls")
          : t("statements.image")
      : null;
  const now = known?.readAt ?? 0;

  return (
    <Screen
      title={t("pages.import")}
      back={{ label: t("nav.ledger"), onPress: () => (router.canGoBack() ? router.back() : router.replace("/transactions" as Href)) }}
      showRefresh={false}
      className="px-0 py-0"
    >
      <ScrollView contentContainerClassName="gap-4 px-4 pb-24 pt-4" keyboardShouldPersistTaps="handled">
        {stage.kind === "start" ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(DURATION.panel)} className="gap-4">
            <View className="gap-4 rounded-card border border-border bg-card/70 p-card">
              <Text variant="title">{t("statements.heading")}</Text>
              <Text variant="muted" className="leading-5">
                {t("statements.intro")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("statements.choose")}
                disabled={pending}
                onPress={() => void pickFile()}
                className="items-center gap-3 rounded-card border-2 border-dashed border-border px-4 py-8 active:bg-foreground/5"
              >
                <Ionicons name="document-attach-outline" size={36} color={colors.mutedForeground} />
                <Text className="text-sm font-medium">
                  {pending ? t("statements.reading") : t("statements.choose")}
                </Text>
                <Text variant="muted" className="text-center text-xs">
                  {t("statements.formats")}
                </Text>
              </Pressable>
              {problem ? (
                <Text accessibilityRole="alert" className="text-sm text-destructive">
                  {problem}
                </Text>
              ) : null}
              <BankGuide />
            </View>

            {imports.length > 0 ? (
              <View className="gap-1 rounded-card border border-border bg-card/70 p-card">
                <Text variant="head" className="pb-1">
                  {t("statements.history")}
                </Text>
                {imports.map((item) => {
                  const account = accounts.find((one) => one.providerAccountId === item.providerAccountId);
                  const name =
                    item.fileName ??
                    account?.label ??
                    (item.bank && isBankId(item.bank) ? BANK_NAMES[item.bank] : t("statements.statement"));
                  const undoable = !item.undoneAt && now - new Date(item.createdAt).getTime() < UNDO_DAYS * 86_400_000;
                  return (
                    <View key={item.id} className="min-h-14 flex-row items-center gap-3 border-t border-border py-2">
                      <View className="flex-1 gap-0.5">
                        <Text numberOfLines={1} className={item.undoneAt ? "text-sm text-muted-foreground line-through" : "text-sm"}>
                          {name}
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {formatFullDate(item.createdAt.slice(0, 10), locale)} ·{" "}
                          {item.undoneAt ? t("statements.undoneTag") : t("statements.added", { count: item.linesNew })}
                        </Text>
                      </View>
                      {undoable ? (
                        <Button
                          label={t("statements.undo")}
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onPress={() => void undo([item.id])}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {reading && statement ? (
          <View className="gap-4">
            {statement.problem === "columns" && statement.table ? (
              <MappingCard
                table={statement.table}
                onRead={(mapping) => {
                  const read = readMappedTable(statement.table!, mapping);
                  open(
                    {
                      ...statement,
                      bank: read.bank,
                      blocks: read.blocks,
                      skipped: read.skipped,
                      problem: read.problem,
                      table: read.problem === "columns" ? statement.table : null,
                    },
                    reading.fileName,
                  );
                }}
              />
            ) : statement.blocks.length === 0 ? (
              <View className="gap-4 rounded-card border border-border bg-card/70 p-card">
                <View className="flex-row items-start gap-2">
                  <Ionicons name="alert-circle-outline" size={ICON.lg} color={colors.foreground} />
                  <Text className="flex-1 text-sm leading-5">
                    {notHere ?? (statement.problem === "empty" ? t("statements.empty") : t("statements.unreadable"))}
                  </Text>
                </View>
                <BankGuide initialBank={statement.bank} />
              </View>
            ) : (
              statement.blocks.map((block, index) => (
                <BlockCard
                  key={index}
                  index={index}
                  block={block}
                  bank={statement.bank}
                  accounts={accounts}
                  choice={choices[index]!}
                  onChoice={(choice) => setChoices((current) => current.map((old, at) => (at === index ? choice : old)))}
                  outcome={outcomes[index] ?? null}
                />
              ))
            )}
            {statement.skipped > 0 ? (
              <Text variant="muted">{t("statements.skipped", { count: statement.skipped })}</Text>
            ) : null}
            {statement.blocks.length > 0 ? (
              <Button
                label={pending ? t("statements.importing") : t("statements.import")}
                size="lg"
                disabled={pending}
                onPress={() => void runImport()}
              />
            ) : null}
            <Button label={t("statements.another")} variant="ghost" onPress={() => setStage({ kind: "start" })} />
          </View>
        ) : null}

        {stage.kind === "done" ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.springify().damping(18)}
            className="items-start gap-4 rounded-card border border-border bg-card/70 p-card"
          >
            <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12).delay(120)}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            </Animated.View>
            <View className="gap-1">
              <Text variant="title">
                {stage.added > 0 ? t("statements.added", { count: stage.added }) : t("statements.nothingNew")}
              </Text>
              {stage.waiting > 0 ? (
                <Text variant="muted">{t("statements.addedWaiting", { count: stage.waiting })}</Text>
              ) : null}
            </View>
            {stage.waiting > 0 ? (
              <Button
                label={t("statements.review")}
                onPress={() =>
                  // Cast while the typed routes are generated by the dev server.
                  router.replace({ pathname: "/transactions", params: { review: "inbox" } } as Href)
                }
              />
            ) : null}
            <Button label={t("statements.another")} variant="outline" onPress={() => setStage({ kind: "start" })} />
            {stage.importIds.length > 0 ? (
              <Button
                label={t("statements.undo")}
                variant="ghost"
                disabled={pending}
                onPress={() => void undo(stage.importIds)}
              />
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
