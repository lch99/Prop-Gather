// Calendar months, in the timezone the people reading them live in.
//
// Every timestamp in this schema is an ISO-8601 UTC string rather than a
// DATETIME column (db/index.js sets dateStrings and explains why), and PropGather
// is a Malaysian product: an admin opening the dashboard at 9am on the 1st means
// the Malaysian 1st. Malaysia is a fixed UTC+8 with no daylight saving, so a
// "month in Malaysia" is just a window shifted eight hours earlier in UTC — no
// timezone database required, which matters because MySQL's CONVERT_TZ needs
// timezone tables that a stock install does not load.
//
// The month boundaries are therefore computed here, in JS, and handed to SQL as
// plain strings. Comparing them with >= / < works because ISO-8601 UTC strings
// sort lexicographically in chronological order.
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000

// 'YYYY-MM' for the Malaysian calendar month `date` falls in.
export function monthKey(date = new Date()) {
  return new Date(date.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 7)
}

// The half-open [start, end) window of UTC timestamps belonging to a Malaysian
// month. Half-open on purpose: an inclusive end would need the last representable
// instant of the month, and any row landing after it would be counted in neither
// month.
export function monthRange(key) {
  const [year, month] = key.split('-').map(Number)
  // Date.UTC rolls month 12 into January of the next year on its own, so
  // December needs no special case.
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - MYT_OFFSET_MS).toISOString(),
    end: new Date(Date.UTC(year, month, 1) - MYT_OFFSET_MS).toISOString()
  }
}

// The `count` most recent Malaysian months, oldest first, ending with the one
// `from` falls in — the x-axis of every trend on the admin dashboard.
export function recentMonths(count, from = new Date()) {
  const [year, month] = monthKey(from).split('-').map(Number)
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1)).toISOString().slice(0, 7)
  )
}
