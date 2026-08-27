/** Observance helpers — no hardcoded stale years in URLs; optional current-year labels only. */

export function usThanksgivingDate(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const day = nov1.getUTCDay();
  const firstThursdayOffset = (4 - day + 7) % 7;
  const firstThursday = 1 + firstThursdayOffset;
  const fourthThursday = firstThursday + 21;
  return new Date(Date.UTC(year, 10, fourthThursday));
}

export function formatUtcMonthDay(month: number, day: number): string {
  const d = new Date(Date.UTC(2000, month - 1, day));
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export function currentUtcYear(now = new Date()): number {
  return now.getUTCFullYear();
}

export function isWithinSeason(
  now: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
): boolean {
  const y = now.getUTCFullYear();
  const start = Date.UTC(y, startMonth - 1, startDay);
  let end = Date.UTC(y, endMonth - 1, endDay, 23, 59, 59);
  const t = now.getTime();
  if (endMonth < startMonth || (endMonth === startMonth && endDay < startDay)) {
    if (t >= start) return true;
    end = Date.UTC(y, endMonth - 1, endDay, 23, 59, 59);
    const prevStart = Date.UTC(y - 1, startMonth - 1, startDay);
    return t <= end || t >= prevStart;
  }
  return t >= start && t <= end;
}

export function daysUntilMonthDay(now: Date, month: number, day: number): number {
  const y = now.getUTCFullYear();
  let target = Date.UTC(y, month - 1, day);
  if (target < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
    target = Date.UTC(y + 1, month - 1, day);
  }
  return Math.ceil((target - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
}
