const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDate(isoDate) {
  const [, year, month, day] = ISO_DATE.exec(isoDate);
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    return false;
  }
  return toIsoDate(toUtcDate(value)) === value;
}

export function addDays(isoDate, days) {
  return toIsoDate(new Date(toUtcDate(isoDate).getTime() + days * MS_PER_DAY));
}

export function daysBetween(fromIsoDate, toIsoDateValue) {
  return Math.round((toUtcDate(toIsoDateValue) - toUtcDate(fromIsoDate)) / MS_PER_DAY);
}

export function isWeekend(isoDate) {
  const weekday = toUtcDate(isoDate).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function addBusinessDays(isoDate, businessDays) {
  const step = businessDays < 0 ? -1 : 1;
  let remaining = Math.abs(businessDays);
  let current = isoDate;
  while (remaining > 0) {
    current = addDays(current, step);
    if (!isWeekend(current)) {
      remaining -= 1;
    }
  }
  return current;
}

export function laterOf(firstIsoDate, secondIsoDate) {
  return firstIsoDate > secondIsoDate ? firstIsoDate : secondIsoDate;
}

export function todayInTimeZone(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
