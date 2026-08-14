// Blocks personal/financial identifiers from being posted into community-visible
// content (forum threads, chat messages, defect reports, petitions).
//
// PDPA 2010 framing: the ownership-proof flow is careful with identity documents
// (consent, audit trail, 14-day purge — see routes/applications.js), but none of
// that helps if a resident types their IC number into a public forum thread that
// every other verified member can read and that has no edit endpoint. This is the
// front door for that same class of data.
//
// Deliberately NOT detected: phone numbers and email addresses. Sharing a
// contractor's or your own number is a core use of the Marketplace and
// "Contractors & Services" forum categories — blocking it would break the
// product to prevent something residents are choosing to disclose about
// themselves. The line drawn here is identifiers that enable impersonation or
// financial fraud, which is a different risk from ordinary contact details.

// Malaysian NRIC birthplace codes that are actually issued: 01–59 (states and
// countries of birth) and 60–85 (foreign-born). 00, 17–20 and 86–99 are unused,
// so checking this rejects a large share of coincidental 12-digit numbers.
function isValidBirthplaceCode(pb) {
  const n = Number(pb)
  return (n >= 1 && n <= 59) || (n >= 60 && n <= 85)
}

// YYMMDD prefix must be a real calendar date. Combined with the birthplace check
// this is what keeps ordinary 12-digit numbers (account numbers, order refs)
// from tripping the NRIC detector.
function isPlausibleNricDate(yy, mm, dd) {
  const month = Number(mm)
  const day = Number(dd)
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  // Reject impossible day-of-month for the given month; year is 2-digit and
  // therefore century-ambiguous, so leap years are accepted permissively.
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  return day <= maxDay
}

// 901231-14-5678, 901231 14 5678, or 901231145678
const NRIC_RE = /(?<!\d)(\d{2})(\d{2})(\d{2})[-\s]?(\d{2})[-\s]?(\d{4})(?!\d)/g

function hasNric(text) {
  for (const m of text.matchAll(NRIC_RE)) {
    const [, yy, mm, dd, pb] = m
    if (isPlausibleNricDate(yy, mm, dd) && isValidBirthplaceCode(pb)) return true
  }
  return false
}

// Luhn checksum — the reason card detection can be strict without false
// positives: a random 16-digit string passes Luhn only ~10% of the time.
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
    // An NRIC is 12 digits and can't reach 13, so there's no overlap to
    // disambiguate here — anything this long that passes Luhn is card-shaped.
    if (passesLuhn(digits)) return true
  }
  return false
}

const DETECTORS = [
  { kind: 'NRIC / IC number', test: hasNric },
  { kind: 'payment card number', test: hasPaymentCard }
]

// Returns the kinds of sensitive identifiers found across all given values.
// Values may be undefined (optional fields) and are coerced to string.
export function detectSensitiveContent(values) {
  const text = values.filter(v => typeof v === 'string' && v).join('\n')
  if (!text) return []
  return DETECTORS.filter(d => d.test(text)).map(d => d.kind)
}

// Human-facing message. Never echoes the matched value back — repeating it in an
// error response would put the identifier into logs and error trackers, which is
// exactly what this check exists to prevent.
export function sensitiveContentMessage(kinds) {
  const list = kinds.join(' and ')
  return `This post looks like it contains a ${list}. For your safety, personal identifiers like these can't be shared in a community space — please remove it and post again.`
}
