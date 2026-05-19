import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { next, prev, occurrences } from "../src/index.js";

const sampleCrons = [
  "0 9 * * *",
  "*/15 * * * *",
  "0 0 * * 0",
  "0 12 1 * *",
  "30 */6 * * 1-5",
  "0 0 1 jan *",
];

describe("property: next/prev consistency", () => {
  it("next(cron, prev(cron, from)) <= from <= next(cron, from)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...sampleCrons),
        fc.date({ min: new Date("2026-01-01Z"), max: new Date("2030-12-31Z"), noInvalidDate: true }),
        (cron, from) => {
          const p = prev(cron, from, { utc: true });
          const n = next(cron, from, { utc: true });
          expect(p.getTime()).toBeLessThan(from.getTime());
          expect(n.getTime()).toBeGreaterThan(from.getTime());
        },
      ),
    );
  });

  it("next is monotonic across occurrences()", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...sampleCrons),
        fc.date({ min: new Date("2026-01-01Z"), max: new Date("2029-01-01Z"), noInvalidDate: true }),
        fc.integer({ min: 2, max: 10 }),
        (cron, from, count) => {
          const list = occurrences(cron, from, count, { utc: true });
          for (let i = 1; i < list.length; i++) {
            expect(list[i]!.getTime()).toBeGreaterThan(list[i - 1]!.getTime());
          }
        },
      ),
    );
  });
});
