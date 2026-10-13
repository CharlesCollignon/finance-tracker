import { describe, expect, it, vi } from "vitest";

import type { Db } from "./client";
import { entraideError, readEntraideList, searchEntraide } from "./entraide";

describe("entraideError", () => {
  it("names each refusal migration 071 gives", () => {
    expect(entraideError({ code: "P0001", message: "no_handle" })).toBe(
      "entraide.noHandle",
    );
    expect(entraideError({ code: "42501", message: "banned" })).toBe(
      "entraide.banned",
    );
    expect(entraideError({ code: "P0001", message: "links_too_soon" })).toBe(
      "entraide.linksTooSoon",
    );
    expect(entraideError({ code: "P0001", message: "rate_limited" })).toBe(
      "errors.tooManyAttempts",
    );
    expect(
      entraideError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "entraide_profiles_handle_unique"',
      }),
    ).toBe("entraide.handleTaken");
    expect(
      entraideError({
        code: "23514",
        message:
          'new row for relation "entraide_profiles" violates check constraint "entraide_profiles_handle"',
      }),
    ).toBe("entraide.handleInvalid");
  });
});

describe("reading Entraide", () => {
  it("names authors by pseudonym, and a gone one by nothing", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: 7,
          kind: "question",
          title: "",
          excerpt: "",
          handle: null,
          is_pluclair: false,
          gone: true,
          created_at: "2026-10-13T08:00:00Z",
          last_activity_at: "2026-10-13T09:00:00Z",
          reply_count: "2",
          solved: false,
          useful_count: "0",
          is_mine: false,
        },
      ],
      error: null,
    });
    const list = await readEntraideList({ rpc } as unknown as Db, {
      filter: "all",
      sort: "recent",
    });
    expect(rpc).toHaveBeenCalledWith("entraide_list", {
      p_filter: "all",
      p_sort: "recent",
      p_offset: 0,
      p_limit: 20,
    });
    expect(list[0]).toMatchObject({
      id: 7,
      gone: true,
      replyCount: 2,
      author: { handle: null, isPluclair: false, isMine: false },
    });
  });

  it("reads a database behind 071 as an empty Entraide", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    const db = { rpc } as unknown as Db;
    expect(
      await readEntraideList(db, { filter: "all", sort: "recent" }),
    ).toEqual([]);
    expect(await searchEntraide(db, "jour de lecture")).toEqual([]);
  });

  it("does not search on two letters", async () => {
    const rpc = vi.fn();
    expect(await searchEntraide({ rpc } as unknown as Db, "pe")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
