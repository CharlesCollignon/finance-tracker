import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The initial of whoever added a joint row, on the corner of its icon —
 * nothing outside « Commun », where every row is the reader's own. The web's
 * twin is `AuthorBadge` in `components/layout/SpaceContext.tsx`.
 */
export function AuthorBadge({
  createdBy,
}: {
  createdBy: string | null | undefined;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { space, joint } = useOwner();
  const author =
    joint && createdBy
      ? space?.members.find((member) => member.userId === createdBy)
      : undefined;
  if (!author) {
    return null;
  }
  return (
    <View
      accessible
      accessibilityLabel={t("space.addedBy", { name: author.name })}
      style={{
        position: "absolute",
        right: -4,
        bottom: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.background,
        backgroundColor: colors.foreground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        className="font-semibold"
        style={{ fontSize: 8, lineHeight: 10, color: colors.background }}
      >
        {(author.name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}
