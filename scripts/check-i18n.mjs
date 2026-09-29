// Audits the translations in src/locales/ against the strings the app uses.
//
//   npm run check:i18n
//
// Finds every English string passed to t(), translate() or msg() in src/, and
// fails if a dictionary is missing one, or if a translation drops or invents a
// {placeholder} (which would print a literal "{name}" to a resident, or lose the
// value it was meant to show).
//
// Strings built at runtime — t(item.label), t(`${level} activity`) — can't be
// read statically. The ones that come from msg() lists are covered; the rest are
// listed as "dynamic" so they can be checked by eye. Dictionary entries no source
// string uses are reported but don't fail the check: backend error messages and
// server data values (tiers, statuses, property types) are meant to be there.

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const srcDir = join(root, 'src')
const LOCALES = ['ms', 'zh']

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'locales') yield* walk(p)
    } else if (/\.(jsx?|mjs)$/.test(entry.name) && entry.name !== 'i18n.jsx') {
      // i18n.jsx is skipped: it defines t() and its header comment's examples
      // aren't real strings.
      yield p
    }
  }
}

// Reads one string literal starting at src[i] (a quote). Returns [value, end]
// or null for a template literal with ${…} in it.
function readString(src, i) {
  const quote = src[i]
  let out = ''
  let j = i + 1
  while (j < src.length && src[j] !== quote) {
    if (src[j] === '\\') {
      const next = src[j + 1]
      out += next === 'n' ? '\n' : next
      j += 2
      continue
    }
    if (quote === '`' && src[j] === '$' && src[j + 1] === '{') return [null, skipTemplate(src, i)]
    out += src[j]
    j++
  }
  return [out, j + 1]
}

function skipTemplate(src, i) {
  let j = i + 1
  let depth = 0
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') { j += 2; continue }
    if (depth === 0 && c === '`') return j + 1
    if (c === '$' && src[j + 1] === '{') { depth++; j += 2; continue }
    if (c === '}' && depth > 0) depth--
    j++
  }
  return j
}

// The string literals in the first argument of a call whose "(" is at `open`,
// so `t(n === 1 ? 'a' : 'b', vars)` yields both 'a' and 'b'.
function firstArgStrings(src, open) {
  const found = []
  let dynamic = false
  let depth = 0
  let j = open + 1
  while (j < src.length) {
    const c = src[j]
    if (c === "'" || c === '"' || c === '`') {
      const [value, end] = readString(src, j)
      if (depth === 0) {
        if (value === null) dynamic = true
        else found.push(value)
      }
      j = end
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break
      depth--
    } else if (c === ',' && depth === 0) break
    j++
  }
  if (!found.length) dynamic = true
  return { found, dynamic }
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')

const used = new Map() // string -> first file it was seen in
const dynamic = []

for await (const file of walk(srcDir)) {
  const src = await readFile(file, 'utf8')
  const rel = relative(root, file)
  for (const m of src.matchAll(/(?<![\w.])(t|translate|msg)\(/g)) {
    const { found, dynamic: isDynamic } = firstArgStrings(src, m.index + m[0].length - 1)
    for (const s of found) if (!used.has(s)) used.set(s, rel)
    if (isDynamic) {
      const line = src.slice(0, m.index).split('\n').length
      dynamic.push(`${rel}:${line}  ${src.slice(m.index, m.index + 60).split('\n')[0]}`)
    }
  }
}

let failed = false

for (const code of LOCALES) {
  const dict = (await import(pathToFileURL(join(srcDir, 'locales', `${code}.js`)).href)).default
  const missing = [...used.keys()].filter(k => !(k in dict))
  const badPlaceholders = Object.entries(dict).filter(([k, v]) => placeholders(k) !== placeholders(v))
  const unused = Object.keys(dict).filter(k => !used.has(k))

  console.log(`\n${code}: ${Object.keys(dict).length} entries, ${used.size} strings in use`)
  if (missing.length) {
    failed = true
    console.log(`  ✗ ${missing.length} missing:`)
    for (const k of missing) console.log(`      ${JSON.stringify(k)}   (${used.get(k)})`)
  }
  if (badPlaceholders.length) {
    failed = true
    console.log(`  ✗ ${badPlaceholders.length} with different {placeholders}:`)
    for (const [k, v] of badPlaceholders) console.log(`      ${JSON.stringify(k)}\n        → ${JSON.stringify(v)}`)
  }
  if (!missing.length && !badPlaceholders.length) console.log('  ✓ complete')
  if (unused.length) console.log(`  · ${unused.length} not referenced statically (server messages and data values are expected here)`)
}

console.log(`\n${dynamic.length} dynamic call(s) — check these keys exist by eye:`)
for (const d of dynamic) console.log(`  ${d}`)

process.exit(failed ? 1 : 0)
