// Where a community's profile picture / cover photo is served from.
//
// Relative to the API base, not absolute: this module has no request and so no
// idea what hostname the caller reached us on. The frontend turns it into a URL
// with mediaUrl() in src/apiClient.js; backend callers that need an absolute one
// (routes/sharePreview.js) prefix their own origin.
//
// The `v` token is the random tail of the S3 key, which changes on every upload
// (buildCommunityImageKey in util/s3.js). The route itself answers with a short
// cache window and a redirect to a presigned URL, so without this a replaced
// photo would keep showing the old one until every cache expired.
export const communityImagePath = (projectId, kind, key) =>
  `/projects/${encodeURIComponent(projectId)}/images/${kind}?v=${encodeURIComponent(key.slice(-12))}`

export const toProject = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  state: row.state,
  city: row.city,
  address: row.address,
  ownerCount: row.owner_count,
  activityLevel: row.activity_level,
  units: row.units,
  blocks: JSON.parse(row.blocks),
  floorsPerBlock: row.floors_per_block,
  latestThread: row.latest_thread,
  // Omitted rather than null when unset, so a caller can write
  // `project.logoUrl ? <img> : <letter tile>` and get the fallback either way.
  ...(row.logo_key ? { logoUrl: communityImagePath(row.id, 'logo', row.logo_key) } : {}),
  ...(row.cover_key ? { coverUrl: communityImagePath(row.id, 'cover', row.cover_key) } : {}),
  ...(row.active_offer_banner ? { activeOfferBanner: true } : {})
})

export const toMembership = (row) => ({
  projectId: row.project_id,
  tier: row.tier,
  unit: row.unit,
  verifiedAt: row.verified_at
})

export const toApplication = (row) => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  unit: row.unit,
  tier: row.tier,
  document: row.document,
  documentFile: row.document_file ? JSON.parse(row.document_file) : null,
  status: row.status,
  submittedAt: row.submitted_at,
  decidedAt: row.decided_at,
  decidedBy: row.decided_by || null,
  consentAcceptedAt: row.consent_accepted_at,
  documentPurgedAt: row.document_purged_at || null,
  ...(row.decided_by_name ? { decidedByName: row.decided_by_name } : {})
})

export const toAuditLogEntry = (row) => ({
  id: row.id,
  actorUserId: row.actor_user_id,
  actorRole: row.actor_role,
  action: row.action,
  targetType: row.target_type,
  targetId: row.target_id,
  projectId: row.project_id,
  metadata: JSON.parse(row.metadata),
  createdAt: row.created_at,
  ...(row.actor_name ? { actorName: row.actor_name } : {})
})

export const toVendor = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  state: row.state,
  districts: JSON.parse(row.districts),
  tier: row.tier,
  rating: row.rating,
  reviews: row.reviews,
  ssmVerified: !!row.ssm_verified,
  ownerRecommended: !!row.owner_recommended,
  description: row.description,
  ...(row.offer ? { offer: row.offer } : {})
})

export const toDocument = (row) => ({
  id: row.id,
  title: row.title,
  category: row.category,
  uploadedBy: row.uploaded_by,
  date: row.date
})

export const toReference = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  description: row.description,
  date: row.date,
  uploadedBy: row.uploaded_by,
  progress: row.progress,
  attachments: JSON.parse(row.attachments)
})
