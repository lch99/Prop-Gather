import { badRequest } from '../util/errors.js'

// Validates req[part] against a zod schema, replacing it with the parsed
// (and thus coerced/defaulted) value. Sends a 400 with field-level detail on failure.
export function validate(schema, part = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part])
    if (!result.success) {
      const details = result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      return next(badRequest('Invalid request data', details))
    }
    req[part] = result.data
    next()
  }
}
