import { todayInTimeZone } from './analysis/dates.js';

export function createClock({ timeZone, fixedToday = null }) {
  return {
    now: () => new Date(),
    today: () => fixedToday ?? todayInTimeZone(timeZone),
  };
}
