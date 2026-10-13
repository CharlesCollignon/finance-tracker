import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useIncomingShare } from "expo-sharing";
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
  readStatementText,
  statementKey,
  withDirection,
  type Statement,
  type StatementBlock,
} from "@finance/core/statement";
import {
  MAX_SENT_FILE_BYTES,
  type StatementImportInput,
  type StatementOutcome,
} from "@finance/core/validations/statements";

import { BankGuide } from "@/components/statements/BankGuide";
import { BlockCard, initialChoice, type BlockChoice } from "@/components/statements/BlockCard";
import { MappingCard } from "@/components/statements/MappingCard";
import { ScanOffer } from "@/components/statements/ScanOffer";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { getWriterState } from "@/lib/ai-writer";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  importStatement,
  previewStatement,
  readFileAccounts,
  readImports,
  readPdfOnServer,
  scanOnServer,
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

/** How the file came: picked here, shared from another app, or as text. */
type Source = StatementImportInput["source"];

/** A file read, ready to be shown: `uri` kept while an AI might read it. */
interface Opened {
  statement: Statement;
  fileName: string;
  source: Source;
  uri: string | null;
}

type Stage =
  | { kind: "start" }
  | ({ kind: "read" } & Opened)
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
  if (format === "xls" || format === "unknown") {
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
    source,
    readByAi: statement.readByAi ?? false,
  };
}

/**
 * Importing a bank statement on the phone, with no bank connection
 * (`docs/plans/STATEMENTS_PLAN.md`) — the web's import, in the phone's own
 * components: the file the bank gives, as it is, read here — a PDF by the
 * server, and a picture or a scan by the person's own AI account when they
 * say so; one card per account it covers; the account asked only when the
 * file does not say; what importing would do, from the server; one button.
 * After, the lines are where the bank's would be — the known ones filed,
 * the rest « À vérifier » — and the import can be undone, whole, for a
 * month.
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
      aiAccount: userId ? (await getWriterState(userId)).account : false,
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
  const [scanning, setScanning] = useState(false);

  function open({ statement, fileName, source, uri }: Opened) {
    setChoices(
      statement.blocks.map((block) => initialChoice(block, statement.bank, accounts, t("statements.accountMine"))),
    );
    setOutcomes(statement.blocks.map(() => null));
    setStage({ kind: "read", statement, fileName, source, uri });
  }

  /**
   * A file read: here, or by the server for a PDF; a picture kept aside
   * for the person's AI, if they want it read.
   */
  async function readUri(uri: string, fileName: string, source: Source): Promise<Opened | { error: string }> {
    const file = new File(uri);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const statement = readStatementFile(bytes);
    if (statement.format === "image") {
      return { statement: { ...statement, problem: "scanned" }, fileName, source, uri };
    }
    if (statement.format !== "pdf") {
      return { statement, fileName, source, uri: null };
    }
    if (bytes.length > MAX_SENT_FILE_BYTES) {
      return { error: t("statements.tooBigToSend") };
    }
    const read = await readPdfOnServer(await file.base64());
    return read.ok ? { statement: read.statement, fileName, source, uri } : { error: resolveMessage(t, read.error) };
  }

  /** The file read by the person's AI account, which they just asked for. */
  async function scan() {
    if (stage.kind !== "read" || !stage.uri) {
      return;
    }
    const { uri, fileName, source } = stage;
    setScanning(true);
    try {
      const file = new File(uri);
      const base64 = await file.base64();
      if (base64.length * 0.75 > MAX_SENT_FILE_BYTES) {
        toast(t("statements.tooBigToSend"), "error");
        return;
      }
      const result = await scanOnServer(base64);
      if (!result.ok) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      void hapticSuccess();
      open({ statement: result.statement, fileName, source, uri: null });
    } catch {
      toast(t("statements.scanFailed"), "error");
    } finally {
      setScanning(false);
    }
  }

  // Files shared to Pluclair from another app (« Partager vers Pluclair »,
  // `app/+native-intent.ts`): read as they come, the first opened, the
  // others waiting their turn.
  const { resolvedSharedPayloads, isResolving, clearSharedPayloads } = useIncomingShare();
  const [queue, setQueue] = useState<Opened[]>([]);
  useEffect(() => {
    if (isResolving || resolvedSharedPayloads.length === 0) {
      return;
    }
    let live = true;
    void (async () => {
      const read: Opened[] = [];
      let failed: string | null = null;
      setPending(true);
      for (const payload of resolvedSharedPayloads) {
        try {
          if (payload.contentUri && payload.contentType !== "text" && payload.contentType !== "website") {
            const opened = await readUri(payload.contentUri, payload.originalName ?? "", "share");
            if ("error" in opened) {
              failed = opened.error;
            } else {
              read.push(opened);
            }
          } else if (payload.shareType === "text" && payload.value) {
            read.push({ statement: readStatementText(payload.value), fileName: "", source: "paste", uri: null });
          }
        } catch {
          // Unreadable: said below, if nothing else could be read either.
        }
      }
      setPending(false);
      clearSharedPayloads();
      if (!live) {
        return;
      }
      const [first, ...rest] = read;
      if (!first) {
        setProblem(failed ?? t("statements.unreadable"));
        return;
      }
      void hapticLight();
      setQueue(rest);
      open(first);
    })();
    return () => {
      live = false;
    };
    // `open` and `t` are this render's; the payloads are what changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSharedPayloads, isResolving]);

  /** The next shared file, or the start again when there is none. */
  function next() {
    const [following, ...rest] = queue;
    setQueue(rest);
    if (following) {
      open(following);
    } else {
      setStage({ kind: "start" });
    }
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
      const opened = await readUri(asset.uri, asset.name ?? "", "file");
      if ("error" in opened) {
        setProblem(opened.error);
        return;
      }
      void hapticLight();
      open(opened);
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
          const input = choices[index] ? inputFor(reading.statement, block, choices[index]!, reading.fileName, reading.source) : null;
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
      const input = inputFor(reading.statement, block, choices[index]!, reading.fileName, reading.source);
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
  // Every line already brought, or left out: nothing an import would add.
  const nothingNew =
    outcomes.length > 0 &&
    outcomes.every((outcome) => outcome !== null && outcome.kept && outcome.known + outcome.left >= outcome.total);
  // What a PDF or a picture needs: the AI's reading, offered — a scan, or a
  // PDF whose text holds no lines Pluclair recognised.
  const scanReason =
    statement && reading?.uri
      ? statement.problem === "scanned"
        ? t("statements.scanned")
        : statement.problem === "unreadable" && statement.format === "pdf"
          ? t("statements.pdfUnread")
          : null
      : null;
  const notHere =
    statement?.problem === "locked"
      ? t("statements.locked")
      : statement?.problem === "notHere"
        ? t("statements.xls")
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
                  open({
                    statement: {
                      ...statement,
                      bank: read.bank,
                      blocks: read.blocks,
                      skipped: read.skipped,
                      problem: read.problem,
                      table: read.problem === "columns" ? statement.table : null,
                    },
                    fileName: reading.fileName,
                    source: reading.source,
                    uri: null,
                  });
                }}
              />
            ) : statement.blocks.length === 0 && scanReason ? (
              <View className="gap-5 rounded-card border border-border bg-card/70 p-card">
                <ScanOffer
                  reason={scanReason}
                  aiAccount={known?.aiAccount ?? false}
                  scanning={scanning}
                  onScan={() => void scan()}
                />
                {scanning ? null : <BankGuide initialBank={statement.bank} />}
              </View>
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
                  readByAi={statement.readByAi ?? false}
                />
              ))
            )}
            {statement.skipped > 0 ? (
              <Text variant="muted">{t("statements.skipped", { count: statement.skipped })}</Text>
            ) : null}
            {nothingNew ? (
              <Text variant="muted" className="text-center">
                {t("statements.nothingNew")}
              </Text>
            ) : statement.blocks.length > 0 ? (
              <Button
                label={pending ? t("statements.importing") : t("statements.import")}
                size="lg"
                disabled={pending}
                onPress={() => void runImport()}
              />
            ) : null}
            <Button
              label={queue.length > 0 ? t("statements.nextFile", { count: queue.length }) : t("statements.another")}
              variant="ghost"
              disabled={scanning}
              onPress={next}
            />
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
            <Button
              label={queue.length > 0 ? t("statements.nextFile", { count: queue.length }) : t("statements.another")}
              variant="outline"
              onPress={next}
            />
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
