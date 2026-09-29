import { badRequest } from '../util/errors.js'
import { detectSensitiveContent, sensitiveContentMessage } from '../util/sensitiveContent.js'

// Rejects a request whose free-text fields contain personal identifiers that
// don't belong in community-visible content. Runs after validate() so it reads
// the parsed, trimmed body.
//
// `fields` names the body keys to scan — always the free-text ones (title, body,
// description, text), never structured fields like unit or category. A field can
// also be a function of the body returning a list of strings, for free text that
// sits deeper than the top level (a forum poll's question and options).
export function blockSensitiveContent(...fields) {
  return (req, _res, next) => {
    const values = fields.flatMap(f => (typeof f === 'function' ? f(req.body || {}) || [] : [req.body?.[f]]))
    const kinds = detectSensitiveContent(values)
    if (kinds.length) return next(badRequest(sensitiveContentMessage(kinds), kinds.map(k => ({ path: 'body', message: `This looks like it contains a ${k}.` }))))
    next()
  }
}
