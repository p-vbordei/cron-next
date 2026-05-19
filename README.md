# cron-next

[![ci](https://github.com/p-vbordei/cron-next/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/cron-next/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/cron-next.svg)](https://www.npmjs.com/package/cron-next)
[![downloads](https://img.shields.io/npm/dm/cron-next.svg)](https://www.npmjs.com/package/cron-next)
[![bundle](https://img.shields.io/bundlejs/size/cron-next)](https://bundlejs.com/?q=cron-next)

> Compute the next or previous occurrence of a 5-field cron expression. Local or UTC. Zero dependencies.

```ts
import { next, prev, occurrences } from "cron-next";

next("0 9 * * 1-5");                              // → next weekday at 09:00 local
next("*/15 * * * *", new Date(), { utc: true });  // → next quarter-hour boundary UTC
prev("0 0 1 * *");                                // → previous month start
occurrences("0 9 * * *", new Date(), 5);          // → next 5 daily firings
```

## Install

```sh
npm install cron-next
```

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

You have a cron string. You need to know **when does it fire next?** Most popular cron libraries are runtime schedulers — they spawn timers and call callbacks. That's overkill when you just want the next fire-time to:

- Show "next run: in 2 hours" in a UI
- Persist `next_run_at` in a database for a row-level scheduler
- Compute the next N occurrences for a calendar view
- Find the previous occurrence to know when the last invocation should have happened

`cron-next` is a pure function. No timers, no callbacks, no scheduler. Give it a cron string and a reference date — get a `Date` back.

## Recipes

### Database-row scheduler

```ts
import { next } from "cron-next";

// After running a job, compute when it next fires
await db.update(`
  UPDATE jobs SET last_run_at = $1, next_run_at = $2 WHERE id = $3
`, [new Date(), next(job.cron), job.id]);

// A separate polling worker grabs rows where next_run_at <= now()
```

### "Next run in ..." UI

```ts
import { next } from "cron-next";
import { format } from "relative-time";

const nextFire = next(job.cron);
console.log(`Next: ${format(nextFire)}`);
// "Next: in 23 minutes"
```

### Calendar / dashboard with upcoming firings

```ts
import { occurrences } from "cron-next";

const upcoming = occurrences("0 9 * * 1-5", new Date(), 10);
for (const d of upcoming) {
  console.log(d.toISOString());
}
```

### "What did I miss?" — find missed occurrences after downtime

```ts
import { occurrences } from "cron-next";

function findMissed(cron: string, lastRunAt: Date, now: Date): Date[] {
  const missed: Date[] = [];
  let cursor = lastRunAt;
  while (true) {
    const n = next(cron, cursor);
    if (n.getTime() > now.getTime()) break;
    missed.push(n);
    cursor = n;
  }
  return missed;
}

// After a 2-hour outage, replay missed runs
const missed = findMissed("*/30 * * * *", lastRunAt, new Date());
for (const _ of missed) await replay();
```

### UTC vs local clock

```ts
import { next } from "cron-next";

// Local timezone (default): "0 9 * * *" fires at 9am wherever the process is
next("0 9 * * *");

// Force UTC: fires at 09:00 UTC regardless of process timezone
next("0 9 * * *", new Date(), { utc: true });
```

## API

### `next(cron, from?, opts?): Date`

Returns the first occurrence **strictly after** `from`. If `from` matches the cron, the result is the next one — so `next("0 9 * * *", at_09_00)` skips to tomorrow.

| Argument | Type | Default |
|---|---|---|
| `cron` | `string` | required, 5-field POSIX cron |
| `from` | `Date` | `new Date()` |
| `opts` | `OccurrenceOptions` | `{}` |

### `prev(cron, from?, opts?): Date`

Returns the last occurrence **strictly before** `from`.

### `occurrences(cron, from, count, opts?): Date[]`

Returns the next `count` occurrences, each strictly after the previous.

### `OccurrenceOptions`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `utc` | `boolean` | `false` | Interpret clock fields in UTC instead of local time |
| `maxIterations` | `number` | `100_000` | Safety cap on internal step iterations |

## Cron syntax

5 space-separated fields: `minute hour day-of-month month day-of-week`. Supports:

- `*` wildcard
- Integers
- Lists: `1,3,5`
- Ranges: `1-5`
- Steps: `*/5`, `1-10/2`
- Month names: `jan`...`dec`
- Day-of-week names: `sun`...`sat`
- `7` in DOW means Sunday (normalized to `0`)

**OR semantics:** when both day-of-month and day-of-week are restricted (not `*`), an occurrence fires if **either** matches — standard POSIX cron behavior. So `0 0 1 * 1` fires on the 1st of any month **and** every Monday.

Quartz seconds field and `?` are not supported.

## Errors

Throws on:

- Malformed cron expressions (out-of-range values, unknown names, bad syntax)
- `maxIterations` exceeded (only happens on pathological patterns; the default 100k handles even sparse cases like `0 0 29 2 *` — Feb 29 — across multiple leap-year gaps)

## Caveats

- **DST.** Local-time cron expressions in zones with DST will skip the spring-forward hour and run twice in the fall-back hour. `cron-next` matches what real cron daemons do — it doesn't try to be clever. Use `utc: true` to avoid DST entirely.
- **Negative reference dates / dates before 1970** may behave unexpectedly because of JS `Date` edge cases.
- **No 6-field Quartz cron.** If you need seconds-precision or "5th business day of the month" semantics, this isn't the right library.

## License

Apache-2.0 © Vlad Bordei
