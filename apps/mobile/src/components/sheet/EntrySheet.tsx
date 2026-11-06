import { useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { hapticWarning } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";
import { figureFace } from "@/theme/designs";
import { useThemeColors } from "@/theme/useThemeColors";

import { withAlpha } from "../add/kind-ink";
import { sheetFrame } from "@/theme/design-blocks";

/**
 * The frame every entry sheet shares since November 2026 — Ajouter, and
 * the sheets that edit an operation, a recurring entry or a position: a
 * panel from the bottom lit faintly in the colour of the money it holds, a
 * title and a close button, a scrolling body, and a footer that stays put
 * so the action is always one reach away.
 */
export function EntrySheet({
  visible = true,
  onClose,
  title,
  closeLabel,
  ink,
  footer,
  onBack,
  backLabel,
  scrollKey,
  children,
}: {
  visible?: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  /** A step back inside the sheet, drawn as a chevron before the title. */
  onBack?: () => void;
  backLabel?: string;
  /** Changing it starts the body again at the top: a new step. */
  scrollKey?: string;
  /** The colour of the money on the sheet, for the light behind its figure. */
  ink?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.7)",
        }}
      >
        <Pressable
          className="flex-1"
          accessibilityLabel={closeLabel}
          onPress={onClose}
        />
        <View
          style={[{ maxHeight: "92%" }, sheetFrame()]}
          className="overflow-hidden rounded-t-[24px] border border-b-0 border-border bg-card"
        >
          {ink ? <KindGlow color={ink} /> : null}
          <View className="items-center pt-2.5">
            <View className="h-1 w-9 rounded-full bg-hairline-strong" />
          </View>
          <View
            className={cn(
              "flex-row items-center justify-between pr-2 pt-1.5",
              onBack ? "pl-2" : "pl-5",
            )}
          >
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={backLabel ?? title}
                onPress={onBack}
                className="h-11 w-11 items-center justify-center rounded-full"
              >
                <Ionicons
                  name="chevron-back"
                  size={ICON.lg}
                  color={colors.foreground}
                />
              </Pressable>
            ) : null}
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              className="flex-1 font-semibold"
              style={{ fontSize: 17 }}
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <Ionicons
                name="close"
                size={ICON.xl}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
          <ScrollView
            key={scrollKey}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View className="border-t border-border px-4 pb-6 pt-2.5">
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The kind's colour, faint, behind the figure: the light the sheet is lit by. */
export function KindGlow({ color }: { color: string }) {
  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-0 h-64">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="kind-glow" cx="50%" cy="38%" rx="62%" ry="62%">
            <Stop offset="0" stopColor={color} stopOpacity={0.14} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#kind-glow)" />
      </Svg>
    </View>
  );
}

/**
 * The amount as the subject of the sheet, and the field that edits it: the
 * figure in the money serif and its kind's colour, with an invisible input
 * over it that raises the number pad. A line under the figure in the same
 * colour says it is being typed into.
 */
export function FigureInput({
  value,
  onChange,
  ink,
  sign = "",
  symbol = "€",
  label,
  caption,
}: {
  /** As typed, in the reader's own shape: "42,5". */
  value: string;
  onChange: (value: string) => void;
  ink: string;
  sign?: string;
  symbol?: string;
  label: string;
  /** The line under the figure: what this amount is, said back. */
  caption?: string;
}) {
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const empty = value.trim() === "";
  const color = empty ? withAlpha(ink, 0.45) : ink;

  return (
    <View className="items-center pb-1 pt-4">
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        className="items-center px-4 pb-2"
      >
        <RNText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={{
            fontFamily: figureFace(),
            fontSize: 54,
            letterSpacing: -1.8,
            color,
            fontVariant: ["tabular-nums"],
          }}
        >
          {sign ? <RNText style={{ fontSize: 30 }}>{sign}</RNText> : null}
          {empty ? "0" : value}
          <RNText style={{ fontSize: 28 }}>{` ${symbol}`}</RNText>
        </RNText>
        <View
          style={{
            height: 2,
            width: 48,
            borderRadius: 1,
            marginTop: 2,
            backgroundColor: focused ? ink : "transparent",
          }}
        />
        <TextInput
          ref={input}
          value={value}
          onChangeText={(next) => onChange(next.replace(/[^\d.,\s-]/g, ""))}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          caretHidden
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0,
          }}
        />
      </Pressable>
      {caption ? (
        <Text
          variant="muted"
          numberOfLines={1}
          className="px-6 text-center text-[13px]"
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A figure that is read rather than typed — a payment still to come, a
 * position's value today — set like `FigureInput`, so a sheet that only
 * shows its money still opens on it.
 */
export function FigureValue({
  value,
  ink,
  caption,
  children,
}: {
  value: string;
  ink: string;
  caption?: string;
  /** Under the caption: a reason, a note. */
  children?: ReactNode;
}) {
  // Privacy mode masks a figure that is only shown, as `PrivateAmount` does.
  const { hidden } = usePrivacy();
  return (
    <View className="items-center gap-1 pb-1 pt-4">
      <RNText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={{
          fontFamily: figureFace(),
          fontSize: 48,
          letterSpacing: -1.6,
          color: ink,
          fontVariant: ["tabular-nums"],
        }}
      >
        {hidden ? "••••••" : value}
      </RNText>
      {caption ? (
        <Text variant="muted" className="px-4 text-center text-[13px]">
          {caption}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** A field with its name above it, and a hint under the name when it needs one. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("gap-1.5", className)}>
      <Text className="text-xs font-semibold text-muted-foreground">
        {label}
      </Text>
      {hint ? (
        <Text variant="muted" className="-mt-0.5 text-xs">
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/**
 * The save button every entry sheet ends on: orange, the one primary action,
 * saying what it will do — or, greyed, what it is waiting for.
 */
export function SaveButton({
  label,
  figure,
  disabled,
  onPress,
}: {
  label: string;
  /** Set after the label in the money serif: « Enregistrer −42,50 € ». */
  figure?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ backgroundColor: disabled ? colors.secondary : colors.primary }}
      className="h-[52px] flex-row items-center justify-center gap-2 rounded-2xl px-3 active:opacity-80"
    >
      <Text
        numberOfLines={1}
        className="font-semibold"
        style={{
          fontSize: 15.5,
          color: disabled ? colors.mutedForeground : colors.primaryForeground,
        }}
      >
        {label}
        {figure ? (
          <Text
            style={{
              fontFamily: figureFace(),
              fontSize: 16,
              color: disabled
                ? colors.mutedForeground
                : colors.primaryForeground,
              fontVariant: ["tabular-nums"],
            }}
          >
            {` ${figure}`}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

/**
 * Removing what the sheet holds, at the bottom and in words: a quiet line in
 * the destructive colour, then, once pressed, what removing it does and the
 * two answers side by side — never a system alert.
 */
export function DangerAction({
  label,
  explanation,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
}: {
  label: string;
  explanation: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const colors = useThemeColors();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={() => {
          void hapticWarning();
          setAsking(true);
        }}
        className="min-h-11 flex-row items-center gap-2 self-start active:opacity-70"
      >
        <Ionicons name="trash-outline" size={ICON.md} color={colors.destructive} />
        <Text className="text-sm font-medium text-destructive">{label}</Text>
      </Pressable>
    );
  }
  return (
    <View
      className="gap-3 rounded-2xl border p-3.5"
      style={{
        borderColor: withAlpha(colors.destructive, 0.4),
        backgroundColor: withAlpha(colors.destructive, 0.06),
      }}
    >
      <Text className="text-sm">{explanation}</Text>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={onConfirm}
          style={{ backgroundColor: colors.destructive }}
          className="h-11 flex-1 items-center justify-center rounded-xl active:opacity-80"
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.destructiveForeground }}
          >
            {confirmLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => setAsking(false)}
          className="h-11 flex-1 items-center justify-center rounded-xl border border-border active:bg-secondary"
        >
          <Text className="text-sm font-medium">{cancelLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
