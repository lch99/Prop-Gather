import { badRequest } from '../util/errors.js'

// zod's built-in messages are written for developers ("String must contain at
// least 1 character(s)", "Required", "Invalid enum value. Expected 'a' | 'b'").
// Anything matching these is replaced with plain English; a message the schema
// author wrote by hand is always kept, since it's already resident-facing.
const ZOD_DEFAULT_MESSAGE = /^(Required|Invalid|Expected .+, received .+|String must contain|Number must be|Array must contain|Invalid enum value|Invalid literal value)/

// 'projectId' -> 'Project', 'documentFile.size' -> 'Document file', 'options.0' -> 'Options'
function fieldLabel(path) {
  const leaf = path.split('.').filter(p => p && !/^\d+$/.test(p)).pop()
  if (!leaf) return 'This form'
  return leaf
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase())
}

function friendlyMessage(issue) {
  if (issue.message && !ZOD_DEFAULT_MESSAGE.test(issue.message)) return issue.message

  const label = fieldLabel(issue.path.join('.'))
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' || issue.received === 'null'
        ? `${label} is required.`
        : `${label} isn't in the right format.`
    case 'too_small':
      return issue.type === 'string'
        ? (issue.minimum <= 1 ? `${label} is required.` : `${label} must be at least ${issue.minimum} characters.`)
        : `${label} needs at least ${issue.minimum} item${issue.minimum === 1 ? '' : 's'}.`
    case 'too_big':
      return issue.type === 'string'
        ? `${label} is too long — please keep it under ${issue.maximum} characters.`
        : `${label} can have at most ${issue.maximum} item${issue.maximum === 1 ? '' : 's'}.`
    case 'invalid_enum_value':
    case 'invalid_literal':
      return `Please choose a valid option for ${label.toLowerCase()}.`
    case 'invalid_string':
      return issue.validation === 'email'
        ? "That email address doesn't look quite right."
        : `${label} isn't in the right format.`
    default:
      return `Please check the ${label.toLowerCase()} field.`
  }
}

// Validates req[part] against a zod schema, replacing it with the parsed
// (and thus coerced/defaulted) value. Sends a 400 with field-level detail on failure.
export function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part])
    if (!result.success) {
      const details = result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: friendlyMessage(i)
      }))
      // One problem reads better as the headline than a generic summary does;
      // several are listed by field so the resident knows where to look.
      const summary = details.length === 1
        ? details[0].message
        : `Please check these fields: ${[...new Set(details.map(d => fieldLabel(d.path)))].join(', ')}.`
      return next(badRequest(summary, details))
    }
    req[part] = result.data
    next()
  }
}
