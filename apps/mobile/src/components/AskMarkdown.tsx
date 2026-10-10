import { useMemo } from "react";
import { ScrollView, View } from "react-native";

import {
  parseAskMarkdown,
  type AskAlign,
  type AskInline,
} from "@finance/core/ask-markdown";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

const ALIGN: Record<AskAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * An Ask Pluclair answer on the phone, the twin of the web's `AskMarkdown`:
 * the same blocks (`@finance/core/ask-markdown`) drawn with the phone's own
 * text. A table scrolls sideways on its own; every figure is a
 * `PrivateAmount`, so the privacy mode hides it, and one the app found
 * nowhere is underlined in dots.
 */
export function AskMarkdown({
  markdown,
  untraced = [],
}: {
  markdown: string;
  untraced?: readonly string[];
}) {
  const blocks = useMemo(
    () => parseAskMarkdown(markdown, untraced),
    [markdown, untraced],
  );
  return (
    <View className="gap-3">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "heading":
            return (
              <Text
                key={index}
                accessibilityRole="header"
                className={cn(
                  "font-semibold",
                  block.level === 2 ? "text-base" : "text-sm",
                )}
              >
                <Inline nodes={block.inline} />
              </Text>
            );
          case "paragraph":
            return (
              <Text key={index} className="text-sm leading-5">
                <Inline nodes={block.inline} />
              </Text>
            );
          case "list":
            return (
              <View key={index} className="gap-1">
                {block.items.map((item, at) => (
                  <View key={at} className="flex-row gap-2 pl-1">
                    <Text variant="muted" className="text-sm leading-5">
                      {block.ordered ? `${block.start + at}.` : "•"}
                    </Text>
                    <Text className="flex-1 text-sm leading-5">
                      <Inline nodes={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case "table":
            return (
              <ScrollView
                key={index}
                horizontal
                showsHorizontalScrollIndicator={false}
                className="rounded-control border border-border"
              >
                <View>
                  {[block.header, ...block.rows].map((row, at) => (
                    <View
                      key={at}
                      className={cn(
                        "flex-row",
                        at === 0 ? "bg-muted" : "border-t border-border",
                      )}
                    >
                      {row.map((cell, column) => (
                        <Text
                          key={column}
                          className={cn(
                            "w-32 px-3 py-2 text-sm",
                            at === 0 && "font-semibold",
                            ALIGN[block.align[column] ?? "left"],
                          )}
                        >
                          <Inline nodes={cell} />
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          case "quote":
            return (
              <View key={index} className="border-l-2 border-border pl-3">
                <Text variant="muted" className="text-sm leading-5">
                  <Inline nodes={block.inline} />
                </Text>
              </View>
            );
          case "rule":
            return <View key={index} className="h-px bg-border" />;
        }
      })}
    </View>
  );
}

function Inline({ nodes }: { nodes: readonly AskInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "text":
            return node.text;
          case "strong":
            return (
              <Text key={index} className="text-sm font-semibold">
                <Inline nodes={node.children} />
              </Text>
            );
          case "em":
            return (
              <Text key={index} className="text-sm italic">
                <Inline nodes={node.children} />
              </Text>
            );
          case "code":
            return (
              <Text key={index} className="bg-muted font-mono text-sm">
                {node.text}
              </Text>
            );
          case "figure":
            return (
              <PrivateAmount
                key={index}
                className="text-sm font-medium"
                style={
                  node.traced
                    ? undefined
                    : {
                        textDecorationLine: "underline",
                        textDecorationStyle: "dotted",
                      }
                }
              >
                {node.text}
              </PrivateAmount>
            );
        }
      })}
    </>
  );
}
