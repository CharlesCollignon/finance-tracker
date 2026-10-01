import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { useT } from "@/providers/LocaleProvider";

interface PickerSheetProps {
  open: boolean;
  /** What is being chosen; the sheet's heading. */
  title: string;
  onClose: () => void;
  /** Fixed above the options: a search box, the kind chips. */
  header?: ReactNode;
  children: ReactNode;
}

/**
 * The phone's picker panel: a second sheet over the form that opened it.
 *
 * The web drops its panel under the field it belongs to. A phone has no room
 * beside a field for that, and a panel growing inside a scrolling form would
 * push the rest of the form out of reach, so the choice comes up from the
 * bottom instead, where the thumb already is, and closes on the choice.
 *
 * Rendered inside the form's own sheet, which is what lets one Modal stand
 * on another on both platforms.
 */
export function PickerSheet({
  open,
  title,
  onClose,
  header,
  children,
}: PickerSheetProps) {
  const t = useT();

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
        />
        <View className="max-h-[80%] rounded-t-card border border-border bg-card pb-8">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between gap-3 px-5 pb-2">
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              className="min-w-0 flex-1 font-semibold"
              style={{ fontSize: 18 }}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              onPress={onClose}
              hitSlop={8}
              className="min-h-11 justify-center"
            >
              <Text variant="muted">{t("common.close")}</Text>
            </Pressable>
          </View>
          {header ? <View className="gap-3 px-5 pb-3">{header}</View> : null}
          <ScrollView
            className="px-4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
