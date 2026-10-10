"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import {
  parseAskMarkdown,
  type AskAlign,
  type AskInline,
} from "@finance/core/ask-markdown";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

const ALIGN: Record<AskAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * An Ask Pluclair answer, drawn from its Markdown (`@finance/core/
 * ask-markdown`): headings, paragraphs, lists, a table that scrolls on its
 * own at phone width, quotes for a rule of thumb. Every figure is its own
 * element, so the privacy blur reaches it; one the app found nowhere is
 * underlined in dots, with why on hover.
 *
 * Read again on every piece while the answer streams in: a half-written
 * table is a paragraph until its separator arrives. `trailing` — the caret
 * while it streams — sits at the end of the last words, wherever they are.
 */
export function AskMarkdown({
  markdown,
  untraced = [],
  trailing = null,
}: {
  markdown: string;
  untraced?: readonly string[];
  trailing?: ReactNode;
}) {
  const blocks = useMemo(
    () => parseAskMarkdown(markdown, untraced),
    [markdown, untraced],
  );
  const lastBlock = blocks.length - 1;
  const lastKind = blocks[lastBlock]?.kind;
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        const tail = index === lastBlock ? trailing : null;
        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              <h3 key={index} className="pt-1 text-base font-semibold">
                <Inline nodes={block.inline} />
                {tail}
              </h3>
            ) : (
              <h4 key={index} className="pt-1 font-semibold">
                <Inline nodes={block.inline} />
                {tail}
              </h4>
            );
          case "paragraph":
            return (
              <p key={index}>
                <Inline nodes={block.inline} />
                {tail}
              </p>
            );
          case "list": {
            const items = block.items.map((item, at) => (
              <li key={at} className="pl-1">
                <Inline nodes={item} />
                {at === block.items.length - 1 ? tail : null}
              </li>
            ));
            return block.ordered ? (
              <ol
                key={index}
                start={block.start}
                className="flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground"
              >
                {items}
              </ol>
            ) : (
              <ul
                key={index}
                className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground"
              >
                {items}
              </ul>
            );
          }
          case "table":
            return (
              <div
                key={index}
                className="overflow-x-auto rounded-control border border-border"
              >
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      {block.header.map((cell, column) => (
                        <th
                          key={column}
                          className={cn(
                            "whitespace-nowrap px-3 py-2 font-medium",
                            ALIGN[block.align[column] ?? "left"],
                          )}
                        >
                          <Inline nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {block.rows.map((row, at) => (
                      <tr key={at}>
                        {row.map((cell, column) => (
                          <td
                            key={column}
                            className={cn(
                              "px-3 py-2 tabular-nums",
                              ALIGN[block.align[column] ?? "left"],
                            )}
                          >
                            <Inline nodes={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="border-l-2 border-border pl-3 text-muted-foreground"
              >
                <Inline nodes={block.inline} />
                {tail}
              </blockquote>
            );
          case "rule":
            return <hr key={index} className="border-border" />;
        }
      })}
      {/* After a table or a rule, the caret has no words to follow. */}
      {lastKind === "table" || lastKind === "rule" ? <p>{trailing}</p> : null}
    </div>
  );
}

function Inline({ nodes }: { nodes: readonly AskInline[] }) {
  const t = useT();
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "text":
            return <Fragment key={index}>{node.text}</Fragment>;
          case "strong":
            return (
              <strong key={index} className="font-semibold text-foreground">
                <Inline nodes={node.children} />
              </strong>
            );
          case "em":
            return (
              <em key={index}>
                <Inline nodes={node.children} />
              </em>
            );
          case "code":
            return (
              <code
                key={index}
                className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
              >
                {node.text}
              </code>
            );
          case "figure":
            return (
              <PrivateAmount
                key={index}
                title={node.traced ? undefined : t("ask.untraced")}
                className={cn(
                  "whitespace-nowrap font-medium tabular-nums text-foreground",
                  !node.traced &&
                    "underline decoration-muted-foreground decoration-dotted underline-offset-4",
                )}
              >
                {node.text}
              </PrivateAmount>
            );
        }
      })}
    </>
  );
}
