// Detects personal/financial identifiers in text the resident is about to post.
//
// This is a deliberate mirror of `backend/src/util/sensitiveContent.js` — the
// two codebases share a data contract but no code, so the rules are duplicated
// rather than imported. Keep them in step: the backend is the one that actually
// enforces (it returns 400), and this copy exists so a resident is warned while
// typing instead of losing their post to a server rejection.
//
// Deliberately NOT detected: phone numbers and email addresses. Sharing a
// contractor's number is a core use of the Marketplace and "Contractors &
// Services" categories — blocking it would break the product to prevent
// something residents are choosing to disclose about themselves.

// Malaysian NRIC birthplace codes that are actually issued: 01–59 and 60–85.
// 00, 17–20 and 86–99 are unused, so checking this rejects a large share of
// coincidental 12-digit numbers.
function isValidBirthplaceCode(pb) {
  const n = Number(pb)
  return (n >= 1 && n <= 59) || (n >= 60 && n <= 85)
}

function isPlausibleNricDate(yy, mm, dd) {
  const month = Number(mm)
  const day = Number(dd)
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  return day <= maxDay
}

const NRIC_RE = /(?<!\d)(\d{2})(\d{2})(\d{2})[-\s]?(\d{2})[-\s]?(\d{4})(?!\d)/g

function hasNric(text) {
  for (const m of text.matchAll(NRIC_RE)) {
    const [, yy, mm, dd, pb] = m
    if (isPlausibleNricDate(yy, mm, dd) && isValidBirthplaceCode(pb)) return true
  }
  return false
}

// Luhn checksum — why card detection can be strict without false positives:
// a random 16-digit string passes only ~10% of the time.
function passesLuhn(digits) {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

const CARD_RE = /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g

function hasPaymentCard(text) {
  for (const m of text.matchAll(CARD_RE)) {
    const digits = m[0].replace(/[ -]/g, '')
    if (digits.length < 13 || digits.length > 19) continue
    if (passesLuhn(digits)) return true
  }
  return false
}

const DETECTORS = [
  { kind: 'NRIC / IC number', test: hasNric },
  { kind: 'payment card number', test: hasPaymentCard }
]

// Returns the kinds of sensitive identifiers found across the given values.
export function detectSensitiveContent(values) {
  const text = values.filter(v => typeof v === 'string' && v).join('\n')
  if (!text) return []
  return DETECTORS.filter(d => d.test(text)).map(d => d.kind)
}

// Never includes the matched value — repeating it would put the identifier into
// the DOM and any error reporting, which is what this check exists to prevent.
export function sensitiveContentMessage(kinds) {
  return `This looks like it contains a ${kinds.join(' and ')}. For your safety, personal identifiers like these can't be shared in a community space — please remove it before posting.`
}

// Convenience for form components: returns a message string, or null if clean.
export function sensitiveContentWarning(...values) {
  const kinds = detectSensitiveContent(values)
  return kinds.length ? sensitiveContentMessage(kinds) : null
}
