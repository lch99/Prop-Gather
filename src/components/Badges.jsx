import { C, badge, tierColor } from '../theme'

export function TierBadge({ tier }) {
  const color = tierColor(tier)
  return <span style={badge(color, `${color}1a`)}>{tier}</span>
}

export function VerifiedBadge() {
  return (
    <span style={badge(C.success, C.successBg)} title="Verified resident">
      ✓ Verified
    </span>
  )
}

export function AuthorLine({ author }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
      <span style={{ fontWeight: 600 }}>{author.name}</span>
      {author.unit && author.unit !== '-' && (
        <span style={{ color: C.textMuted }}>· {author.unit}</span>
      )}
      <TierBadge tier={author.tier} />
      {author.verified && <VerifiedBadge />}
    </div>
  )
}
