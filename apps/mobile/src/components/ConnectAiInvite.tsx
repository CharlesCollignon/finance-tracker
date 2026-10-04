import { Pressable } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";

/**
 * Where a written read would be, for an account that writes with its own AI
 * account and has not connected one: one quiet line, opening the Profile —
 * the web's `ConnectAiInvite`. No button that would only refuse.
 */
export function ConnectAiInvite() {
  const t = useT();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={8}
      onPress={() => {
        void hapticLight();
        router.push("/profile");
      }}
    >
      <Text variant="muted" className="text-sm underline">
        {t("aiAccount.connectFirst")}
      </Text>
    </Pressable>
  );
}
