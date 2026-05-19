import { describe, it, expect } from "vitest";
import { next, prev, occurrences } from "../src/index.js";

const utc = (s: string) => new Date(s + "Z");

describe("next", () => {
  it("every minute → +1 min", () => {
    const from = utc("2026-05-19T12:00:30.000");
    const n = next("* * * * *", from, { utc: true });
    expect(n.toISOString()).toBe("2026-05-19T12:01:00.000Z");
  });

  it("daily at 09:00", () => {
    const from = utc("2026-05-19T12:00:00.000");
    const n = next("0 9 * * *", from, { utc: true });
    expect(n.toISOString()).toBe("2026-05-20T09:00:00.000Z");
  });

  it("monday only", () => {
    // 2026-05-19 is Tuesday; next Monday at 12:00 UTC is 2026-05-25
    const from = utc("2026-05-19T15:00:00.000");
    const n = next("0 12 * * 1", from, { utc: true });
    expect(n.toISOString()).toBe("2026-05-25T12:00:00.000Z");
  });

  it("step every 15 minutes", () => {
    const from = utc("2026-05-19T12:05:00.000");
    const n = next("*/15 * * * *", from, { utc: true });
    expect(n.toISOString()).toBe("2026-05-19T12:15:00.000Z");
  });

  it("Feb 29 (next leap year)", () => {
    // 2026 is not a leap year; next Feb 29 is 2028
    const from = utc("2026-03-01T00:00:00.000");
    const n = next("0 0 29 2 *", from, { utc: true });
    expect(n.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("dom + dow OR semantics", () => {
    // 1st of month OR Sunday at 0:00
    // From Mon 2026-05-04 — next is Sunday 2026-05-10
    const from = utc("2026-05-04T00:00:00.000");
    const n = next("0 0 1 * 0", from, { utc: true });
    expect(n.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  it("strictly after the boundary", () => {
    // If from = 09:00 and cron fires at 09:00 — next is 24h later
    const from = utc("2026-05-19T09:00:00.000");
    const n = next("0 9 * * *", from, { utc: true });
    expect(n.toISOString()).toBe("2026-05-20T09:00:00.000Z");
  });
});

describe("prev", () => {
  it("daily at 09:00 before noon", () => {
    const from = utc("2026-05-19T12:00:00.000");
    const p = prev("0 9 * * *", from, { utc: true });
    expect(p.toISOString()).toBe("2026-05-19T09:00:00.000Z");
  });

  it("daily at 09:00 before 08:00 → yesterday", () => {
    const from = utc("2026-05-19T08:00:00.000");
    const p = prev("0 9 * * *", from, { utc: true });
    expect(p.toISOString()).toBe("2026-05-18T09:00:00.000Z");
  });

  it("strictly before the boundary", () => {
    const from = utc("2026-05-19T09:00:00.000");
    const p = prev("0 9 * * *", from, { utc: true });
    expect(p.toISOString()).toBe("2026-05-18T09:00:00.000Z");
  });
});

describe("occurrences", () => {
  it("returns N future occurrences", () => {
    const from = utc("2026-05-19T00:00:00.000");
    const list = occurrences("0 9 * * *", from, 3, { utc: true });
    expect(list.map((d) => d.toISOString())).toEqual([
      "2026-05-19T09:00:00.000Z",
      "2026-05-20T09:00:00.000Z",
      "2026-05-21T09:00:00.000Z",
    ]);
  });
});

describe("errors", () => {
  it("throws on malformed cron", () => {
    expect(() => next("not a cron", new Date(), { utc: true })).toThrow();
  });
});
