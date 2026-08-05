# Data Protection Officer — role reference

**This is a reference for filling the role, not an appointment.** Appointing
a DPO is a decision only you (the business owner/operator) can make, and it
must be followed by actually notifying the Personal Data Protection
Commissioner (JPDP) — nothing in this repo can do either of those for you.
This doc exists so that when you do designate someone, you have the
requirements in one place instead of hunting through guidelines.

## Why this is required

Since 1 June 2025, Malaysia's PDPA (as amended) requires **both data
controllers and data processors** to appoint at least one DPO. Guidelines on
the appointment were issued by the Commissioner on 25 February 2025.

## What the DPO is accountable for

- Ensuring PropGather's processing of personal data complies with the PDPA
  — most concretely: the ownership-proof document flow
  (`backend/src/routes/applications.js`), audit trail
  (`GET /api/audit-log`), and retention purge
  (`backend/src/jobs/purgeApplications.js`).
- Being the point of contact for data subject requests (access, correction,
  portability, withdrawal — see `src/pages/PrivacyPage.jsx` §7) received at
  `privacy@propgather.com`.
- Filing the 72-hour breach notification to the Commissioner if needed (see
  `backend/docs/BREACH_RESPONSE.md`) — this is likely the DPO's single most
  time-critical duty.
- Being the named contact the Commissioner has on file for this
  organization.

## What you need to actually do

1. Decide who — could be you, an employee, or an external/outsourced DPO
   service. There's no requirement it be a dedicated full-time role for an
   operation this size, but they need to actually understand the app's data
   flows well enough to act on them.
2. Notify the Commissioner of the appointment (per the Feb 2025 guidelines —
   check https://www.pdp.gov.my for the current notification process/form).
3. Update `privacy@propgather.com`'s routing (or add a dedicated address) so
   requests actually reach that person.
4. Give them read access to `GET /api/audit-log` (they'll need an admin
   account) and a copy of `backend/docs/BREACH_RESPONSE.md`.
5. Fill in the `[ FILL IN ]` placeholders in `BREACH_RESPONSE.md` with their
   name/contact once designated.

## What this repo does NOT do

Nothing here creates a "DPO" user role, sends any notification to the
Commissioner, or otherwise treats a DPO as appointed. `PrivacyPage.jsx`
intentionally does not claim a DPO exists until one actually does — adding
that claim before it's true would misrepresent your compliance status.
