import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { CategoryFacts } from "@finance/core/category-facts";
import {
  renderCategoryRead,
  type CategoryRead as CategoryReadValue,
} from "@finance/core/category-read";
import { LOCALE_LABELS, type Locale } from "@finance/core/i18n/locale";
import { exactModelLabel } from "@finance/core/model-name";
import { BylineMark, WriterMark } from "@/components/AiMark";
import type { ReadSegment } from "@finance/core/month-read";

import { ConnectAiInvite } from "@/components/ConnectAiInvite";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { writeCategoryRead } from "@/lib/category-screen";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * A category, in words — the web's `CategoryRead`, at phone width.
 *
 * The prose is a model's, every figure in it is the app's: the model writes
 * `{{fact:id}}` and `renderCategoryRead` puts the app's own formatted value
 * there, rendered from the current figures, so a number here can never
 * contradict the bars above it. Said plainly: this was written by a model.
 */
export function CategoryRead({
  categoryId,
  categoryName,
  read,
  readFacts,
  readLocale,
  thin,
  writesLeft,
  writable,
  account,
  writerBrand,
  readModel,
}: {
  categoryId: string;
  categoryName: string;
  /** Null when nothing has been written for this category. */
  read: CategoryReadValue | null;
  /** The category's current figures, labelled in `readLocale`. */
  readFacts: CategoryFacts | null;
  /** The language the prose is in, which may not be the reader's. */
  readLocale: Locale;
  /** Too little recorded to be worth a read; the writer is not offered. */
  thin: boolean;
  writesLeft: number;
  /** Whether a read can be asked for from this build at all. */
  writable: boolean;
  /** Written on the user's own AI account: no count, and an invitation without one. */
  account: boolean;
  writerBrand: string;
  /** The model recorded on the stored read, when there is one. */
  readModel: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);
  const [left, setLeft] = useState(writesLeft);

  const rendered =
    read && readFacts
      ? renderCategoryRead(read, readFacts, formatMoney, readLocale)
      : null;
  const inAnotherLanguage = Boolean(rendered) && readLocale !== locale;

  // Too little recorded to be worth offering one: the server refuses it.
  if (!rendered && thin) {
    return null;
  }
  // Nothing to show and nothing that could be written: with no AI account
  // connected, the card that says how to connect one, where the read would be.
  if (!rendered && !writable) {
    return !account ? <ConnectAiInvite variant="card" /> : null;
  }

  async function write() {
    if (pending) {
      return;
    }
    setPending(true);
    const outcome = await writeCategoryRead(categoryId);
    setPending(false);
    if (outcome.writesLeft !== null) {
      setLeft(outcome.writesLeft);
    }
    if (outcome.written) {
      void hapticSuccess();
    }
    if (outcome.message || outcome.written) {
      toast(
        outcome.message ??
          t("categoryRead.writtenToast", { category: categoryName }),
        outcome.written ? "success" : "error",
      );
    }
  }

  return (
    <View className="gap-3 rounded-card border border-border bg-card/70 p-4">
      <View className="gap-1">
        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name="sparkles-outline"
            size={ICON.sm}
            color={colors.mutedForeground}
          />
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("categoryRead.title")}
          </Text>
        </View>
        <Text variant="muted" className="text-xs">
          {t("categoryRead.subtitle", { model: writerBrand })}
        </Text>
      </View>

      {rendered ? (
        <View className="gap-2">
          {rendered.observations.map((row, index) => (
            <View key={index} className="flex-row items-start gap-2">
              <View
                className={cn(
                  "mt-2 h-1.5 w-1.5 rounded-full",
                  row.tone === "good"
                    ? "bg-success"
                    : row.tone === "watch"
                      ? "bg-destructive"
                      : "bg-muted-foreground",
                )}
              />
              <Text className="min-w-0 flex-1 text-sm">
                <Segments segments={row.segments} />
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="muted" className="text-sm">
          {t("categoryRead.empty")}
        </Text>
      )}

      {rendered && rendered.suggestions.length > 0 ? (
        <View className="gap-2 border-t border-border pt-2">
          {rendered.suggestions.map((row, index) => (
            <View key={index} className="flex-row items-start gap-2">
              <View className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <Text className="min-w-0 flex-1 text-sm">
                <Segments segments={row.segments} />
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="gap-2 border-t border-border pt-2">
        {inAnotherLanguage || rendered ? (
          <View className="flex-row items-center gap-1">
            {rendered ? <BylineMark model={readModel} /> : null}
            <Text variant="micro" className="flex-1 text-xs">
              {[
                inAnotherLanguage
                  ? t("categoryRead.writtenInOtherLanguage", {
                      language: LOCALE_LABELS[readLocale],
                    })
                  : null,
                // Which model, exactly — off this read rather than today's
                // configuration, because they are not always the same one.
                rendered
                  ? readModel === null
                    ? t("categoryRead.writtenByUnknown")
                    : t("categoryRead.writtenBy", {
                        model: exactModelLabel(readModel),
                      })
                  : null,
              ]
                .filter(Boolean)
                .join(" ")}
            </Text>
          </View>
        ) : null}

        {!writable && !account ? (
          <ConnectAiInvite />
        ) : writable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: pending || left <= 0 }}
            disabled={pending || left <= 0}
            onPress={() => {
              void hapticLight();
              void write();
            }}
            className={cn(
              "min-h-11 flex-row items-center justify-center gap-1.5 rounded-full px-4",
              left > 0 ? "bg-primary" : "border border-border",
              (pending || left <= 0) && "opacity-60",
            )}
          >
            <WriterMark
              model={writerBrand}
              size={ICON.md}
              color={
                left > 0 ? colors.primaryForeground : colors.mutedForeground
              }
            />
            <Text
              className={cn(
                "text-sm font-medium",
                left > 0 ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {pending
                ? t("categoryRead.writing")
                : left <= 0
                  ? t("categoryRead.noReadsLeft")
                  : account
                    ? rendered
                      ? t("aiAccount.writeAgain", { model: writerBrand })
                      : t("aiAccount.writeOne", { model: writerBrand })
                    : rendered
                      ? t("categoryRead.writeAgain", { left, model: writerBrand })
                      : t("categoryRead.writeOne", { left, model: writerBrand })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Prose and figures, interleaved: each figure behind the privacy mask. */
function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Text key={index} className="text-sm">
            {segment.text}
          </Text>
        ) : (
          <PrivateAmount key={index} className="text-sm font-medium">
            {segment.display}
          </PrivateAmount>
        ),
      )}
    </>
  );
}
