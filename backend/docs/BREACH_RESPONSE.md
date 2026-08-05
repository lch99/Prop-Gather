# Data breach response runbook

**Status: template — not a substitute for legal advice.** This gives you a
starting checklist and the legal deadline; have a PDPA-qualified lawyer
review and adapt it before relying on it, and fill in the placeholders below
before you actually need it.

## Why this exists

Since 1 June 2025, Malaysia's PDPA (as amended) requires a data controller to
notify the Personal Data Protection Commissioner **within 72 hours** of
becoming aware of a personal data breach, and to notify affected individuals
where the breach is likely to cause significant harm. Failing to notify is a
separate offence from the breach itself.

## What counts as a breach here

Anything that exposes, alters, or destroys personal data without
authorization — most sensitive in this app:
- Ownership-proof documents (`applications.document_file` / the S3/R2 bucket) — IC numbers, SPAs, utility bills, property titles
- The `users` table (names, emails, password hashes)
- `applications` (name, email, phone, unit) and `fee_payments` (financial records)

Examples: leaked/committed AWS or R2 credentials, a JWT secret leak, a
misconfigured bucket made public, unauthorized database access, a dependency
vulnerability actively exploited, an admin account compromise.

## Immediate steps (first 24 hours)

1. **Contain it.** Rotate the credential/secret involved
   (`JWT_SECRET`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, `DB_PATH`
   access), revoke exposed presigned URLs isn't possible retroactively but
   they expire in 5–15 minutes by design — confirm the exposure window.
   Take the affected system offline if containment requires it.
2. **Scope it.** What data, how many records, which users. The `audit_log`
   table (`GET /api/audit-log`) is your first source for who accessed what,
   when — check it as part of the investigation. If credential compromise is
   suspected, filter `?action=auth.login_failed` (repeated failures against
   one account are a brute-force signal) and `?action=auth.admin_login` (was
   the admin account used from somewhere/somewhen unexpected).
3. **Record the facts as you learn them** — timeline, what happened, what
   data, how many people, what you've done so far. You'll need this for the
   Commissioner notification regardless of final severity assessment.

## Notify the Commissioner (within 72 hours of becoming aware)

- Who: Jabatan Perlindungan Data Peribadi (JPDP) / Personal Data Protection
  Department — see https://www.pdp.gov.my for current notification channels
  and the official breach notification form.
- **[ FILL IN: who internally is responsible for filing this — this must be
  your designated Data Protection Officer once appointed (see
  PDPA_COMPLIANCE_CHECKLIST.md item 1) ]**
- What to include: nature of the breach, categories and approximate number
  of data subjects/records affected, likely consequences, measures taken or
  proposed to address it and mitigate harm, your contact details.

## Notify affected individuals (if significant harm is likely)

- Required when the breach could cause significant harm (identity theft,
  financial loss, etc.) — an IC/SPA/utility-bill leak likely qualifies.
- Plain-language notice: what happened, what data, what you're doing, what
  they should do (e.g. monitor for suspicious activity), and a contact
  channel (`privacy@propgather.com` or your designated DPO contact).
- **[ FILL IN: notification method — email is the obvious channel since
  every user has one on file ]**

## After

- Post-incident review: root cause, what changed to prevent recurrence.
- Update this runbook with anything that didn't work.
- If the breach implicates a specific route/table, check whether it needs
  the same audit-logging/retention treatment as `applications` already has
  (see `src/util/audit.js`).

## Outstanding gaps in this runbook

- No actual DPO is named yet — see `PDPA_COMPLIANCE_CHECKLIST.md` and
  `DPO_ROLE.md`.
- Detection is partial, not real monitoring. `auth.login_failed` /
  `auth.admin_login` audit entries and per-account login rate-limiting
  (`backend/src/middleware/rateLimit.js`) exist and slow down /
  leave a trail for credential-stuffing attempts — but nothing pushes an
  alert to anyone. The "becoming aware of" 72-hour clock only starts once a
  human actually reads `GET /api/audit-log` or is told some other way.
  Real alerting (email/webhook on suspicious patterns) is still needed
  before you can reliably meet the deadline.
