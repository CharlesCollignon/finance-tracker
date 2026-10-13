import { Fragment } from "react";
import {
  parseAskMarkdown,
  type AskBlock,
  type AskInline,
} from "@finance/core/ask-markdown";
import { cn } from "@/lib/utils";

/**
 * What a member wrote, drawn from the little Markdown Ask answers in
 * (`parseAskMarkdown`), with links: to a web address only, and marked as a
 * member's (`rel="ugc nofollow"`), so search engines do not take them as
 * Pluclair's. Every word is a React child — nothing written is ever read
 * as HTML. Amounts are words here: a member's figures are not the reader's,
 * and nothing hides them.
 */
export function EntraideText({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const blocks = parseAskMarkdown(markdown, [], { links: true });
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 break-words text-[0.975rem] leading-relaxed text-marketing-muted",
        className,
      )}
    >
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: AskBlock }) {
  switch (block.kind) {
    case "heading":
      return (
        <p className="font-head text-marketing-ink">
          <Inline nodes={block.inline} />
        </p>
      );
    case "paragraph":
      return (
        <p className="whitespace-pre-line">
          <Inline nodes={block.inline} />
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List
          start={block.ordered ? block.start : undefined}
          className={cn(
            "flex flex-col gap-1.5 pl-5 marker:text-marketing-faint",
            block.ordered ? "list-decimal" : "list-disc",
          )}
        >
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline nodes={item} />
            </li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-marketing-ink">
                {block.header.map((cell, index) => (
                  <th key={index} className="px-2 py-1.5 font-medium">
                    <Inline nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-white/5">
                  {row.map((cell, index) => (
                    <td key={index} className="px-2 py-1.5">
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
        <blockquote className="border-l-2 border-white/15 pl-4 italic">
          <Inline nodes={block.inline} />
        </blockquote>
      );
    case "rule":
      return <hr className="border-white/10" />;
  }
}

function Inline({ nodes }: { nodes: readonly AskInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "text":
            return <Fragment key={index}>{node.text}</Fragment>;
          case "figure":
            return (
              <span key={index} className="whitespace-nowrap tabular-nums">
                {node.text}
              </span>
            );
          case "strong":
            return (
              <strong key={index} className="font-medium text-marketing-ink">
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
                className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[0.85em] text-marketing-ink"
              >
                {node.text}
              </code>
            );
          case "link":
            return (
              <a
                key={index}
                href={node.href}
                target="_blank"
                rel="ugc nofollow noopener noreferrer"
                className="text-marketing-ink underline decoration-white/30 underline-offset-4 transition-colors duration-hover hover:decoration-white/80"
              >
                <Inline nodes={node.children} />
              </a>
            );
        }
      })}
    </>
  );
}
