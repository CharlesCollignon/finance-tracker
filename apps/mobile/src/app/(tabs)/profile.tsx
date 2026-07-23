import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/providers/AuthProvider";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <Screen title="Profile">
      <View className="gap-4">
        <Card>
          <Text variant="label" className="mb-1">
            Signed in as
          </Text>
          <Text variant="head">{user?.email ?? "Unknown"}</Text>
          <Text variant="muted" className="mt-1">
            Provider: {user?.app_metadata.provider ?? "email"}
          </Text>
        </Card>

        <Card>
          <Text variant="label" className="mb-1">
            Coming soon
          </Text>
          <Text variant="muted">
            Display name, delete all data, and delete account arrive in a later
            phase.
          </Text>
        </Card>

        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </Screen>
  );
}
