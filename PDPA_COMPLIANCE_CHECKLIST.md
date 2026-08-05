# PDPA compliance checklist

Tracks where PropGather stands against Malaysia's Personal Data Protection
Act 2010 (as amended by the Personal Data Protection (Amendment) Act 2024,
phased in Jan/Apr/Jun 2025). **This is not legal advice and not a compliance
certification** — it's a working list so nothing falls through the cracks
before a real launch. Have a Malaysia-qualified data protection lawyer
review this and the linked code before you rely on it.

## Done (code-level)

- [x] Explicit consent capture for identity documents (`applications.consent`,
      required; `consent_accepted_at` recorded) — `backend/src/routes/applications.js`
- [x] Access control — admin-only / owner-only reads, JWT auth, per-project
      membership gating — `backend/src/middleware/auth.js`
- [x] Document storage — private bucket, encrypted at rest, short-lived
      presigned URLs (not permanent links) — `backend/src/util/s3.js`,
      `backend/infra/`
- [x] 14-day retention purge for decided applications' documents, both an
      app-level job and a bucket lifecycle backstop —
      `backend/src/jobs/purgeApplications.js`
- [x] Audit trail of submit/view/decide/withdraw/purge, with `decided_by`
      accountability — `backend/src/util/audit.js`, `GET /api/audit-log`
- [x] Cross-border transfer disclosed and consented to at the point of
      upload (documents may be stored outside Malaysia via our cloud
      storage provider) — `src/pages/RegisterPage.jsx`,
      `src/pages/PrivacyPage.jsx` §6
- [x] **Cross-border transfer record-keeping** (PDPA s.129) — every
      submission logs an `application.cross_border_transfer` audit entry with
      receiver, region/endpoint, purpose, data category, and the consent
      timestamp relied on — `backend/src/routes/applications.js`,
      `backend/src/util/s3.js#describeStorageDestination`. Queryable via
      `GET /api/audit-log?action=application.cross_border_transfer`.
- [x] Privacy Policy covers what's collected, why (and whether it's
      mandatory), retention, source of data, children's data, and PDPA
      rights (access/correction/portability/withdrawal/complaint) —
      `src/pages/PrivacyPage.jsx`
- [x] **Bilingual Privacy Notice (EN + Bahasa Malaysia)**, as PDPA's Notice
      and Choice Principle requires — `src/pages/PrivacyPage.jsx` (language
      toggle). The BM text is a good-faith translation, explicitly flagged
      in-page as not yet reviewed by a native/legal speaker.
- [x] Failed-login audit logging (`auth.login_failed`) and successful-admin-login
      logging (`auth.admin_login`), plus per-account login rate-limiting
      (10 attempts / 15 min) — `backend/src/routes/auth.js`,
      `backend/src/middleware/rateLimit.js`. Supports breach *detection*,
      which the runbook's 72-hour clock depends on.
- [x] Self-service deletion of a user's own forum posts and chat messages
      (admins can delete any) — `DELETE /api/projects/:projectId/forum/:threadId`,
      `DELETE .../chat/:channel/messages/:messageId`, wired into
      `ForumTab.jsx`/`ChatTab.jsx`. Extends the "withdraw consent / delete my
      data" right beyond just the verification document.
- [x] Breach response runbook (template) — `backend/docs/BREACH_RESPONSE.md`
- [x] DPO role reference doc (what the role must do once someone is
      appointed — not an appointment itself) — `backend/docs/DPO_ROLE.md`

## Not done — organizational/legal, code cannot close these

No amount of further coding closes these — they need a decision or action
only you (or your lawyer) can take:

- [ ] **Appoint a Data Protection Officer** and notify the Commissioner.
      Required since 1 June 2025 for both data controllers and data
      processors. See `backend/docs/DPO_ROLE.md` for what the role covers —
      but appointing an actual person and filing the notification is on you.
- [ ] **Confirm whether PropGather must register as a data controller.**
      "Real Estate" is a registrable class but, per public sources, appears
      to mean *licensed housing developers* specifically (Housing Development
      Act) — not agents, property managers, or community platforms. That
      reading suggests PropGather likely doesn't fall under it, but this is
      not a legal determination and depends on your actual business/corporate
      structure. Confirm with a lawyer before relying on it — the penalty for
      failing to register when required is up to RM500,000 or 3 years'
      imprisonment.
- [ ] **Operationalize the breach response runbook** — assign a real named
      owner (presumably your DPO once appointed), actually test it, and fill
      in the `[ FILL IN ]` placeholders in `backend/docs/BREACH_RESPONSE.md`.
- [ ] **Legal review of the Privacy Policy and its BM translation** —
      `src/pages/PrivacyPage.jsx` now covers the Section 7 Notice and Choice
      checklist items I could find (purpose, mandatory-vs-voluntary, source
      of data, third-party classes, children's data, rights) in both
      languages, but neither has been reviewed by counsel.
- [ ] **Real breach monitoring/alerting.** What's built (failed-login /
      admin-login audit logging + rate limiting) helps *detect* one class of
      incident and slows down brute-force attempts — it is not a monitoring
      system. Nothing pages anyone; someone has to go read
      `GET /api/audit-log`. A real deployment should add actual alerting
      (email/Slack webhook on suspicious patterns) before the 72-hour clock
      is something you can reliably meet.
- [ ] **Business registration status** — if PropGather isn't yet operating
      as a registered Malaysian business entity, that's a separate, prior
      question from PDPA compliance itself. I have no way to check this.

## Deliberately not done — forum/chat retention

Earlier drafts of this checklist listed "no retention policy for forum/chat"
as a gap. On reflection that's the wrong instinct: the Retention Principle
says don't keep data *longer than necessary for the purpose collected* —
and an ongoing community's discussion history has an ongoing purpose (unlike
a verification document, whose purpose is fully served once a decision is
made). Auto-deleting forum posts on a timer would break the product for no
compliance benefit. What residents *do* get is the right to delete their own
contributions on demand (done, see above) — that's the correct mechanism
here, not a retention clock.

Fee payment records (`fee_payments`) are similar: Malaysia's other laws
(e.g. tax/company record-keeping requirements) generally argue for *keeping*
financial records for years, not deleting them early — so no purge job was
added there either. Access to them was already correctly scoped (a resident
only ever sees their own payments; `GET /fees` filters by `req.user.id`).

## Where this came from

See the PDPA research done 2026-08-04 (chat history) for sources — Malaysia
PDPA seven principles and Section 7 notice requirements, the 2024 Amendment
Act's phased effective dates, cross-border transfer guidelines (April 2025),
DPO/breach-notification guidelines (Feb 2025), and registered data-user
classes.
