const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

interface FieldSpec {
  min: number;
  max: number;
  names?: readonly string[];
}

const SPECS: readonly FieldSpec[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12, names: MONTH_NAMES },
  { min: 0, max: 7, names: DAY_NAMES },
];

interface Fields {
  minute: number[];
  hour: number[];
  dom: number[];
  month: number[];
  dow: number[];
  domRestricted: boolean;
  dowRestricted: boolean;
}

function parseAtom(atom: string, spec: FieldSpec): number {
  const lower = atom.toLowerCase();
  if (spec.names) {
    const idx = spec.names.indexOf(lower as never);
    if (idx >= 0) return idx + spec.min;
  }
  if (!/^\d+$/.test(atom)) throw new Error(`invalid value: ${atom}`);
  const n = parseInt(atom, 10);
  if (n < spec.min || n > spec.max) throw new Error(`out of range: ${atom}`);
  return n;
}

function expandField(raw: string, spec: FieldSpec): number[] {
  if (!raw) throw new Error("empty field");
  const set = new Set<number>();
  for (const piece of raw.split(",")) {
    if (!piece) throw new Error("empty list entry");
    let step = 1;
    let body = piece;
    const slashIdx = piece.indexOf("/");
    if (slashIdx >= 0) {
      const stepStr = piece.slice(slashIdx + 1);
      body = piece.slice(0, slashIdx);
      if (!/^\d+$/.test(stepStr)) throw new Error(`invalid step: ${piece}`);
      step = parseInt(stepStr, 10);
      if (step <= 0) throw new Error(`step must be > 0: ${piece}`);
    }
    let lo: number, hi: number;
    if (body === "*") {
      lo = spec.min;
      hi = spec.max;
    } else if (body.includes("-")) {
      const [a, b] = body.split("-");
      lo = parseAtom(a!, spec);
      hi = parseAtom(b!, spec);
      if (lo > hi) throw new Error(`inverted range: ${piece}`);
    } else {
      const v = parseAtom(body, spec);
      if (slashIdx >= 0) {
        lo = v;
        hi = spec.max;
      } else {
        set.add(v);
        continue;
      }
    }
    for (let i = lo; i <= hi; i += step) set.add(i);
  }
  return [...set].sort((a, b) => a - b);
}

function parseFields(cron: string): Fields {
  const tokens = cron.trim().split(/\s+/);
  if (tokens.length !== 5) throw new Error(`expected 5 fields, got ${tokens.length}`);
  const minute = expandField(tokens[0]!, SPECS[0]!);
  const hour = expandField(tokens[1]!, SPECS[1]!);
  const dom = expandField(tokens[2]!, SPECS[2]!);
  const month = expandField(tokens[3]!, SPECS[3]!);
  const dowRaw = expandField(tokens[4]!, SPECS[4]!);
  const dow = [...new Set(dowRaw.map((v) => (v === 7 ? 0 : v)))].sort((a, b) => a - b);
  return {
    minute,
    hour,
    dom,
    month,
    dow,
    domRestricted: tokens[2] !== "*",
    dowRestricted: tokens[4] !== "*",
  };
}

export interface OccurrenceOptions {
  /** Use UTC clock fields. Default false (local time). */
  utc?: boolean;
  /** Hard cap on internal iterations. Default 100000. */
  maxIterations?: number;
}

function get(d: Date, field: "Y" | "M" | "D" | "h" | "m" | "dow", utc: boolean): number {
  if (utc) {
    if (field === "Y") return d.getUTCFullYear();
    if (field === "M") return d.getUTCMonth() + 1;
    if (field === "D") return d.getUTCDate();
    if (field === "h") return d.getUTCHours();
    if (field === "m") return d.getUTCMinutes();
    return d.getUTCDay();
  }
  if (field === "Y") return d.getFullYear();
  if (field === "M") return d.getMonth() + 1;
  if (field === "D") return d.getDate();
  if (field === "h") return d.getHours();
  if (field === "m") return d.getMinutes();
  return d.getDay();
}

function setYMD(d: Date, y: number, m1: number, day: number, utc: boolean): void {
  if (utc) d.setUTCFullYear(y, m1 - 1, day);
  else d.setFullYear(y, m1 - 1, day);
}
function setHMS(d: Date, h: number, mi: number, utc: boolean): void {
  if (utc) d.setUTCHours(h, mi, 0, 0);
  else d.setHours(h, mi, 0, 0);
}
function addMinutes(d: Date, n: number): void {
  d.setTime(d.getTime() + n * 60_000);
}
function addDays(d: Date, n: number, utc: boolean): void {
  if (utc) d.setUTCDate(d.getUTCDate() + n);
  else d.setDate(d.getDate() + n);
}

function dateMatches(f: Fields, d: Date, utc: boolean): boolean {
  const domMatch = !f.domRestricted || f.dom.includes(get(d, "D", utc));
  const dowMatch = !f.dowRestricted || f.dow.includes(get(d, "dow", utc));
  if (f.domRestricted && f.dowRestricted) return domMatch || dowMatch;
  return domMatch && dowMatch;
}

function findNext(arr: number[], v: number, strict: boolean): number | undefined {
  for (const x of arr) if (strict ? x > v : x >= v) return x;
  return undefined;
}
function findPrev(arr: number[], v: number, strict: boolean): number | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    const x = arr[i]!;
    if (strict ? x < v : x <= v) return x;
  }
  return undefined;
}

function stepForward(f: Fields, d: Date, utc: boolean): boolean {
  const m1 = get(d, "M", utc);
  if (!f.month.includes(m1)) {
    const nxt = findNext(f.month, m1, true);
    if (nxt !== undefined) {
      setYMD(d, get(d, "Y", utc), nxt, 1, utc);
    } else {
      setYMD(d, get(d, "Y", utc) + 1, f.month[0]!, 1, utc);
    }
    setHMS(d, 0, 0, utc);
    return false;
  }
  if (!dateMatches(f, d, utc)) {
    addDays(d, 1, utc);
    setHMS(d, 0, 0, utc);
    return false;
  }
  const h = get(d, "h", utc);
  if (!f.hour.includes(h)) {
    const nxt = findNext(f.hour, h, true);
    if (nxt !== undefined) {
      setHMS(d, nxt, 0, utc);
    } else {
      addDays(d, 1, utc);
      setHMS(d, 0, 0, utc);
    }
    return false;
  }
  const mn = get(d, "m", utc);
  if (!f.minute.includes(mn)) {
    const nxt = findNext(f.minute, mn, true);
    if (nxt !== undefined) {
      setHMS(d, h, nxt, utc);
    } else {
      setHMS(d, h + 1, 0, utc);
    }
    return false;
  }
  return true;
}

function lastDayOfMonth(year: number, month1: number, utc: boolean): number {
  const probe = new Date(0);
  if (utc) probe.setUTCFullYear(year, month1, 0);
  else probe.setFullYear(year, month1, 0);
  return utc ? probe.getUTCDate() : probe.getDate();
}

function stepBackward(f: Fields, d: Date, utc: boolean): boolean {
  const m1 = get(d, "M", utc);
  if (!f.month.includes(m1)) {
    const prv = findPrev(f.month, m1, true);
    if (prv !== undefined) {
      const y = get(d, "Y", utc);
      setYMD(d, y, prv, lastDayOfMonth(y, prv, utc), utc);
    } else {
      const y = get(d, "Y", utc) - 1;
      const lastMonth = f.month[f.month.length - 1]!;
      setYMD(d, y, lastMonth, lastDayOfMonth(y, lastMonth, utc), utc);
    }
    setHMS(d, 23, 59, utc);
    return false;
  }
  if (!dateMatches(f, d, utc)) {
    addDays(d, -1, utc);
    setHMS(d, 23, 59, utc);
    return false;
  }
  const h = get(d, "h", utc);
  if (!f.hour.includes(h)) {
    const prv = findPrev(f.hour, h, true);
    if (prv !== undefined) {
      setHMS(d, prv, 59, utc);
    } else {
      addDays(d, -1, utc);
      setHMS(d, 23, 59, utc);
    }
    return false;
  }
  const mn = get(d, "m", utc);
  if (!f.minute.includes(mn)) {
    const prv = findPrev(f.minute, mn, true);
    if (prv !== undefined) {
      setHMS(d, h, prv, utc);
    } else {
      if (h === 0) {
        addDays(d, -1, utc);
        setHMS(d, 23, 59, utc);
      } else {
        setHMS(d, h - 1, 59, utc);
      }
    }
    return false;
  }
  return true;
}

/** Return the next occurrence strictly after `from`. */
export function next(cron: string, from: Date = new Date(), opts: OccurrenceOptions = {}): Date {
  const f = parseFields(cron);
  const utc = !!opts.utc;
  const max = opts.maxIterations ?? 100_000;
  const d = new Date(from.getTime());
  d.setMilliseconds(0);
  if (utc) d.setUTCSeconds(0);
  else d.setSeconds(0);
  addMinutes(d, 1);
  for (let i = 0; i < max; i++) {
    if (stepForward(f, d, utc)) return d;
  }
  throw new Error("no occurrence found within iteration limit");
}

/** Return the previous occurrence strictly before `from`. */
export function prev(cron: string, from: Date = new Date(), opts: OccurrenceOptions = {}): Date {
  const f = parseFields(cron);
  const utc = !!opts.utc;
  const max = opts.maxIterations ?? 100_000;
  const d = new Date(from.getTime());
  d.setMilliseconds(0);
  if (utc) d.setUTCSeconds(0);
  else d.setSeconds(0);
  addMinutes(d, -1);
  for (let i = 0; i < max; i++) {
    if (stepBackward(f, d, utc)) return d;
  }
  throw new Error("no occurrence found within iteration limit");
}

/** Return the next `count` occurrences after `from`. */
export function occurrences(
  cron: string,
  from: Date = new Date(),
  count: number,
  opts: OccurrenceOptions = {},
): Date[] {
  const out: Date[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const n = next(cron, cursor, opts);
    out.push(n);
    cursor = n;
  }
  return out;
}
