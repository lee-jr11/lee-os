export type CalendarRule =
 | { kind: 'daily'; time: string; timezone: string }
 | { kind: 'weekly'; time: string; timezone: string; dayOfWeek: number };

export type CalendarOccurrence = {
 scheduledFor: string;
 scheduledLocal: string;
 timezone: string;
 nextRunAt: string;
 skipped: number;
};

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string) {
 let value = formatters.get(timezone);
 if (!value) {
  value = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
   timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
   hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  // Force timezone validation now, rather than on the first poll.
  value.format(0);
  formatters.set(timezone, value);
 }
 return value;
}

function partsAt(instant: number, timezone: string): LocalParts {
 const fields = Object.fromEntries(formatter(timezone).formatToParts(instant).map(part => [part.type, part.value]));
 return { year: Number(fields.year), month: Number(fields.month), day: Number(fields.day), hour: Number(fields.hour), minute: Number(fields.minute), second: Number(fields.second) };
}

function wallEpoch(parts: LocalParts) {
 return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function isoDate(year: number, month: number, day: number) {
 return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateParts(date: string, time: string): LocalParts {
 const [year, month, day] = date.split('-').map(Number);
 const [hour, minute] = time.split(':').map(Number);
 return { year, month, day, hour, minute, second: 0 };
}

function dateNumber(date: string) {
 const [year, month, day] = date.split('-').map(Number);
 return Date.UTC(year, month - 1, day);
}

function addDays(date: string, count: number) {
 const value = new Date(dateNumber(date) + count * 86_400_000);
 return isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function localDateAt(instant: number, timezone: string) {
 const p = partsAt(instant, timezone);
 return isoDate(p.year, p.month, p.day);
}

function isoWeekday(date: string) {
 const day = new Date(dateNumber(date)).getUTCDay();
 return day === 0 ? 7 : day;
}

/**
 * Convert a local wall-clock minute to an instant. Repeated DST minutes select
 * the earlier instant. A nonexistent DST minute moves forward by the gap,
 * preserving its minute position (02:30 becomes 03:30 in a one-hour gap).
 */
export function localDateTimeToInstant(date: string, time: string, timezone: string): Date {
 formatter(timezone);
 const target = dateParts(date, time);
 const targetWall = wallEpoch(target);
 const offsets = new Set<number>();
 for (let delta = -48; delta <= 48; delta += 6) {
  const sample = targetWall + delta * 3_600_000;
  const shown = partsAt(sample, timezone);
  offsets.add(wallEpoch(shown) - Math.floor(sample / 1000) * 1000);
 }
 const candidates = [...offsets].map(offset => targetWall - offset);
 const exact = candidates.filter(candidate => {
  const shown = partsAt(candidate, timezone);
  return shown.year === target.year && shown.month === target.month && shown.day === target.day && shown.hour === target.hour && shown.minute === target.minute;
 }).sort((a, b) => a - b);
 if (exact.length) return new Date(exact[0]);

 const forward = candidates.map(candidate => ({ candidate, shown: partsAt(candidate, timezone) }))
  .map(({ candidate, shown }) => ({ candidate, delta: wallEpoch(shown) - targetWall }))
  .filter(item => item.delta > 0)
  .sort((a, b) => a.delta - b.delta || a.candidate - b.candidate);
 if (forward.length) return new Date(forward[0].candidate);
 throw new Error('Could not resolve this local time in the selected timezone.');
}

function occurrence(date: string, rule: CalendarRule) {
 const instant = localDateTimeToInstant(date, rule.time, rule.timezone);
 return { instant, scheduledLocal: `${date}T${rule.time}` };
}

export function nextCalendarOccurrence(after: string | Date, rule: CalendarRule): { scheduledFor: string; scheduledLocal: string } {
 const clock = new Date(after).getTime();
 if (!Number.isFinite(clock)) throw new Error('Invalid schedule reference time.');
 let date = localDateAt(clock, rule.timezone);
 if (rule.kind === 'weekly') {
  const days = (rule.dayOfWeek - isoWeekday(date) + 7) % 7;
  date = addDays(date, days);
 }
 let candidate = occurrence(date, rule);
 if (candidate.instant.getTime() <= clock) {
  date = addDays(date, rule.kind === 'daily' ? 1 : 7);
  candidate = occurrence(date, rule);
 }
 return { scheduledFor: candidate.instant.toISOString(), scheduledLocal: candidate.scheduledLocal };
}

export function dueCalendarOccurrence(next: string | Date, rule: CalendarRule, now: string | Date): CalendarOccurrence {
 const start = new Date(next).getTime();
 const clock = new Date(now).getTime();
 if (!Number.isFinite(start) || !Number.isFinite(clock) || start > clock) throw new Error('Schedule is not due.');
 const today = localDateAt(clock, rule.timezone);
 let latestDate = today;
 if (rule.kind === 'weekly') {
  latestDate = addDays(today, -((isoWeekday(today) - rule.dayOfWeek + 7) % 7));
 }
 let latest = occurrence(latestDate, rule);
 if (latest.instant.getTime() > clock) {
  latestDate = addDays(latestDate, rule.kind === 'daily' ? -1 : -7);
  latest = occurrence(latestDate, rule);
 }
 if (latest.instant.getTime() < start) throw new Error('Due occurrence precedes the schedule start.');
 const firstDate = localDateAt(start, rule.timezone);
 const dayDifference = Math.round((dateNumber(latestDate) - dateNumber(firstDate)) / 86_400_000);
 const countDifference = rule.kind === 'daily' ? dayDifference : Math.floor(dayDifference / 7);
 const nextOccurrence = nextCalendarOccurrence(new Date(clock), rule);
 return {
  scheduledFor: latest.instant.toISOString(), scheduledLocal: latest.scheduledLocal,
  timezone: rule.timezone, nextRunAt: nextOccurrence.scheduledFor,
  skipped: Math.max(0, countDifference)
 };
}
