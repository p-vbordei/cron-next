# cron-next

[![ci](https://github.com/p-vbordei/cron-next/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/cron-next/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/cron-next.svg)](https://www.npmjs.com/package/cron-next)
[![downloads](https://img.shields.io/npm/dm/cron-next.svg)](https://www.npmjs.com/package/cron-next)
[![bundle](https://img.shields.io/bundlejs/size/cron-next)](https://bundlejs.com/?q=cron-next)

Compute the next or previous occurrence of a 5-field cron expression. Local or UTC. Zero dependencies.

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

## API

### `next(cron: string, from?: Date, opts?: OccurrenceOptions): Date`

Returns the first occurrence **strictly after** `from`. If `from` matches the cron, the result is the next one — so `next("0 9 * * *", at09:00)` skips to tomorrow.

### `prev(cron: string, from?: Date, opts?: OccurrenceOptions): Date`

Returns the last occurrence **strictly before** `from`.

### `occurrences(cron: string, from: Date, count: number, opts?: OccurrenceOptions): Date[]`

Returns the next `count` occurrences, each strictly after the previous one.

### `OccurrenceOptions`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `utc` | `boolean` | `false` | Interpret clock fields in UTC instead of local time. |
| `maxIterations` | `number` | `100000` | Safety cap on internal step iterations. |

## Cron syntax

5 space-separated fields: `minute hour day-of-month month day-of-week`. Supports `*`, integers, lists (`1,3,5`), ranges (`1-5`), steps (`*/5`, `1-10/2`), month names (`jan`...`dec`), and day-of-week names (`sun`...`sat`). `7` in DOW means Sunday (normalized to `0`).

**OR semantics:** when both day-of-month and day-of-week are restricted (not `*`), an occurrence fires if **either** matches — standard POSIX cron behavior.

Quartz seconds field and `?` are not supported.

## Errors

Throws on malformed cron expressions or if no occurrence is found within `maxIterations` steps (pathological patterns).

## License

Apache-2.0 © Vlad Bordei
