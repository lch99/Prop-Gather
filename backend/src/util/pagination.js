// ?limit= for a paginated list: a whole number clamped to [1, max], or the
// default when it is missing or not a positive number.
export function pageLimit(value, fallback, max) {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, max)
}
