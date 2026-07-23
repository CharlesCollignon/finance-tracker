import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";

export interface PlaceholderScreenProps {
  title: string;
  description: string;
}

/**
 * Branded stand-in for screens whose real implementation arrives in a later
 * roadmap phase. Keeps the navigation skeleton walkable end to end.
 */
export function PlaceholderScreen({
  title,
  description,
}: PlaceholderScreenProps) {
  return (
    <Screen title={title}>
      <Card>
        <Text variant="label" className="mb-1">
          Coming soon
        </Text>
        <Text variant="muted">{description}</Text>
      </Card>
    </Screen>
  );
}
