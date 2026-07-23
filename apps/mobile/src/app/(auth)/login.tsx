import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";

export default function LoginScreen() {
  return (
    <Screen title="Sign in">
      <View className="gap-4">
        <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
        <Input placeholder="Password" secureTextEntry />
        <Button label="Sign in" />
        <Text variant="muted">
          Auth is wired to Supabase in Phase 3. This screen is a placeholder.
        </Text>
      </View>
    </Screen>
  );
}
