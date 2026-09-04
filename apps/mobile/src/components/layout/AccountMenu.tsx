import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { UserInitial } from "@/components/layout/UserInitial";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/providers/AuthProvider";
import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

function initialFor(email: string | undefined, name: string | undefined) {
  const source = (name ?? email ?? "?").trim();
  return (source.charAt(0) || "?").toUpperCase();
}

/**
 * Header account control: monogram trigger opening a panel with a link to
 * Profile and sign out — the mobile counterpart of the web AccountMenu.
 *
 * The theme toggle used to live here. Pluclair is dark now, with no light
 * palette to switch to.
 */
export function AccountMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined);
  const initial = initialFor(user?.email, displayName);

  const rowClass =
    "min-h-11 w-full flex-row items-center gap-3 rounded-xl px-3";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        hitSlop={6}
        onPress={() => {
          void hapticLight();
          setOpen(true);
        }}
        className="h-9 w-9 items-center justify-center rounded-md"
      >
        <UserInitial initial={initial} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close account menu"
          className="flex-1 bg-black/25"
          onPress={() => setOpen(false)}
        >
          <View className="mt-16 items-end px-4">
            {/* Swallows taps so they do not close the sheet; not a control. */}
            <Pressable
              accessible={false}
              importantForAccessibility="no"
              onPress={(event) => event.stopPropagation()}
            >
              {/* Solid surface: the frosted panel made the rows hard to
                  read against busy content behind it. */}
              <View className="w-72 overflow-hidden rounded-3xl border border-border bg-card">
                <View className="gap-1 p-2">
                  <Pressable
                    accessibilityRole="link"
                    className={cn(rowClass)}
                    onPress={() => {
                      setOpen(false);
                      router.push("/profile");
                    }}
                  >
                    <Ionicons
                      name="settings-outline"
                      size={18}
                      color={colors.foreground}
                    />
                    <Text className="text-sm font-medium">Settings</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    className={cn(rowClass)}
                    onPress={() => {
                      setOpen(false);
                      void signOut();
                    }}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={18}
                      color={colors.foreground}
                    />
                    <Text className="text-sm font-medium">Sign out</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
