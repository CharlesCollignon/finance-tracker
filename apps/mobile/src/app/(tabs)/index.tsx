import { ScrollView, View } from "react-native";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";

export default function DashboardScreen() {
  return (
    <Screen title="Dashboard">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-8">
          <Card>
            <Text variant="label" className="mb-1">
              Phase 2 skeleton
            </Text>
            <Text variant="head" className="mb-2">
              Navigation and design system are wired up.
            </Text>
            <Text variant="muted">
              Real budget data lands in Phase 4 (data layer) and Phase 5
              (screens). Below is the neo-brutalist primitive set ported from
              the web app.
            </Text>
          </Card>

          <Card>
            <Text variant="label" className="mb-3">
              Buttons
            </Text>
            <View className="gap-3">
              <Button label="Primary" />
              <Button label="Secondary" variant="secondary" />
              <Button label="Outline" variant="outline" />
              <Button label="Ghost" variant="ghost" />
            </View>
          </Card>

          <Card>
            <Text variant="label" className="mb-3">
              Badges
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Badge label="Default" />
              <Badge label="Outline" variant="outline" />
              <Badge label="Solid" variant="solid" />
              <Badge label="Surface" variant="surface" />
            </View>
          </Card>

          <Card>
            <Text variant="label" className="mb-3">
              Input
            </Text>
            <Input placeholder="0,00 EUR" keyboardType="decimal-pad" />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
