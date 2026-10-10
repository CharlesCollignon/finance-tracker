import { describe, expect, it } from "vitest";

import { parseAskMarkdown, parseInline, type AskBlock } from "./ask-markdown";

const text = (value: string) => ({ kind: "text" as const, text: value });

describe("parseAskMarkdown", () => {
  it("reads headings, paragraphs and rules", () => {
    const blocks = parseAskMarkdown(
      "# Big\n## Title\n### Small\nOne line\nand its next.\n\n---\nAfter.",
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "heading",
      "heading",
      "paragraph",
      "rule",
      "paragraph",
    ]);
    expect(blocks[0]).toMatchObject({ level: 2 });
    expect(blocks[2]).toMatchObject({ level: 3 });
    expect(blocks[3]).toEqual({
      kind: "paragraph",
      inline: [text("One line and its next.")],
    });
  });

  it("reads lists, a nested item joining its parent's", () => {
    const blocks = parseAskMarkdown(
      "Intro:\n- one\n- two\n  - nested\n  carried on\n\n3. three\n4. four",
    );
    expect(blocks).toEqual<AskBlock[]>([
      { kind: "paragraph", inline: [text("Intro:")] },
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: [[text("one")], [text("two")], [text("nested carried on")]],
      },
      {
        kind: "list",
        ordered: true,
        start: 3,
        items: [[text("three")], [text("four")]],
      },
    ]);
  });

  it("reads a table with its alignment", () => {
    const [table] = parseAskMarkdown(
      "| Mois | Dépenses |\n|:---|---:|\n| mars | 1 200 € |\n| avril |",
    );
    expect(table).toMatchObject({
      kind: "table",
      align: ["left", "right"],
      header: [[text("Mois")], [text("Dépenses")]],
    });
    const rows = (table as Extract<AskBlock, { kind: "table" }>).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]![1]).toEqual([
      { kind: "figure", text: "1 200 €", traced: true },
    ]);
    // A short row is padded to the header's width.
    expect(rows[1]![1]).toEqual([]);
  });

  it("keeps a table a paragraph until its separator arrives", () => {
    expect(parseAskMarkdown("| Mois | Dépenses |")[0]?.kind).toBe("paragraph");
  });

  it("reads quotes", () => {
    expect(parseAskMarkdown("> A rule of thumb\n> on two lines")).toEqual([
      { kind: "quote", inline: [text("A rule of thumb on two lines")] },
    ]);
  });

  it("marks the figures the app could not find", () => {
    const [paragraph] = parseAskMarkdown("Soit 1 234 € et 2 500 €.", [
      "2 500 €",
    ]);
    expect(paragraph).toEqual({
      kind: "paragraph",
      inline: [
        text("Soit "),
        { kind: "figure", text: "1 234 €", traced: true },
        text(" et "),
        { kind: "figure", text: "2 500 €", traced: false },
        text("."),
      ],
    });
  });
});

describe("parseInline", () => {
  it("reads bold, italics and code", () => {
    expect(parseInline("a **b** _c_ *d* `e` __f__")).toEqual([
      text("a "),
      { kind: "strong", children: [text("b")] },
      text(" "),
      { kind: "em", children: [text("c")] },
      text(" "),
      { kind: "em", children: [text("d")] },
      text(" "),
      { kind: "code", text: "e" },
      text(" "),
      { kind: "strong", children: [text("f")] },
    ]);
  });

  it("splits figures out inside bold", () => {
    expect(parseInline("**12 %**")).toEqual([
      {
        kind: "strong",
        children: [{ kind: "figure", text: "12 %", traced: true }],
      },
    ]);
  });

  it("leaves an unclosed mark as written, and snake_case alone", () => {
    expect(parseInline("half **written")).toEqual([text("half **written")]);
    expect(parseInline("a snake_case_word")).toEqual([
      text("a snake_case_word"),
    ]);
  });

  it("shows a link as its words", () => {
    expect(parseInline("see [the AMF](https://amf-france.org)")).toEqual([
      text("see "),
      text("the AMF"),
    ]);
  });
});
