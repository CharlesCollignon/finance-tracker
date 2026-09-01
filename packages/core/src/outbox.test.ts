import { describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS,
  MAX_QUEUE,
  describeOutbox,
  enqueue,
  isRetryableError,
  outboxStatus,
  recordFailure,
  removeEntry,
  willDrop,
  type OutboxEntry,
} from "./outbox";

function entry(id: string, queuedAt = 1000, attempts = 0): OutboxEntry {
  return {
    id,
    payload: {
      categoryId: "cat-1",
      amount: 12.5,
      occurredOn: "2026-09-01",
    },
    queuedAt,
    attempts,
  };
}

describe("enqueue", () => {
  it("appends an entry", () => {
    expect(enqueue([], entry("a")).map((e) => e.id)).toEqual(["a"]);
  });

  it("ignores a repeat of the same id", () => {
    const queue = enqueue([entry("a")], entry("a"));
    expect(queue).toHaveLength(1);
  });

  it("does not mutate the queue it is given", () => {
    const original = [entry("a")];
    enqueue(original, entry("b"));
    expect(original).toHaveLength(1);
  });

  it("caps the queue, dropping the oldest", () => {
    let queue: OutboxEntry[] = [];
    for (let i = 0; i < MAX_QUEUE + 5; i += 1) {
      queue = enqueue(queue, entry(`e${i}`, i));
    }
    expect(queue).toHaveLength(MAX_QUEUE);
    expect(queue[0]!.id).toBe("e5");
  });
});

describe("removeEntry", () => {
  it("removes by id", () => {
    expect(removeEntry([entry("a"), entry("b")], "a").map((e) => e.id)).toEqual(
      ["b"],
    );
  });

  it("is a no-op for an unknown id", () => {
    expect(removeEntry([entry("a")], "zzz")).toHaveLength(1);
  });
});

describe("recordFailure", () => {
  it("counts the attempt and keeps the entry", () => {
    const queue = recordFailure([entry("a")], "a", "network");
    expect(queue[0]!.attempts).toBe(1);
    expect(queue[0]!.lastError).toBe("network");
  });

  it("drops an entry that has failed too many times", () => {
    const queue = recordFailure(
      [entry("a", 1000, MAX_ATTEMPTS - 1)],
      "a",
      "network",
    );
    expect(queue).toHaveLength(0);
  });

  it("leaves other entries alone", () => {
    const queue = recordFailure([entry("a"), entry("b")], "a", "network");
    expect(queue.map((e) => e.id)).toEqual(["a", "b"]);
    expect(queue[1]!.attempts).toBe(0);
  });
});

describe("willDrop", () => {
  it("warns before the final attempt removes an entry", () => {
    expect(willDrop([entry("a", 1000, MAX_ATTEMPTS - 1)], "a")).toBe(true);
  });

  it("is false early on", () => {
    expect(willDrop([entry("a")], "a")).toBe(false);
  });

  it("is false for an unknown id", () => {
    expect(willDrop([entry("a")], "zzz")).toBe(false);
  });
});

describe("outboxStatus", () => {
  it("counts what is waiting", () => {
    const status = outboxStatus([entry("a", 500), entry("b", 900, 2)]);
    expect(status.pending).toBe(2);
    expect(status.oldestQueuedAt).toBe(500);
    expect(status.failing).toBe(1);
  });

  it("is empty for an empty queue", () => {
    expect(outboxStatus([])).toEqual({
      pending: 0,
      oldestQueuedAt: null,
      failing: 0,
    });
  });
});

describe("describeOutbox", () => {
  it("says nothing when the queue is empty", () => {
    expect(describeOutbox(outboxStatus([]))).toBeNull();
  });

  it("uses the singular for one entry", () => {
    expect(describeOutbox(outboxStatus([entry("a")]))).toBe(
      "1 entry waiting to sync",
    );
  });

  it("uses the plural for several", () => {
    expect(describeOutbox(outboxStatus([entry("a"), entry("b")]))).toBe(
      "2 entries waiting to sync",
    );
  });
});

describe("isRetryableError", () => {
  it("queues when there is no message at all", () => {
    expect(isRetryableError(undefined)).toBe(true);
  });

  it("recognises the shapes a lost connection takes", () => {
    expect(isRetryableError("Failed to fetch")).toBe(true);
    expect(isRetryableError("NetworkError when attempting to fetch")).toBe(
      true,
    );
    expect(isRetryableError("Request timeout")).toBe(true);
    expect(isRetryableError("Connection refused")).toBe(true);
  });

  it("does not queue a rejection the user could fix now", () => {
    expect(isRetryableError("Amount must be positive")).toBe(false);
    expect(isRetryableError("Not authenticated")).toBe(false);
    expect(isRetryableError("One of the categories no longer exists")).toBe(
      false,
    );
  });
});
