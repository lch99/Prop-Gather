// PropGather design tokens — inline-style usage: import { C } from './theme'
export const C = {
  navy: '#4c1d95',
  navyDark: '#2e1065',
  // refined jewel-toned indigo→violet→rose; smooth 4-stop flow reads as rich, not harsh. All stops clear WCAG AA with white text.
  headerGradient: 'linear-gradient(125deg, #4338ca 0%, #6d28d9 38%, #9333ea 66%, #c2356b 100%)',
  // a wider gradient used for the animated, shifting hero backdrop
  headerGradientWide: 'linear-gradient(125deg, #4338ca 0%, #6d28d9 28%, #9333ea 52%, #c2356b 76%, #6d28d9 100%)',
  // warm glow blobs — present enough to feel joyful, soft falloff so it stays calm
  heroGlow: 'radial-gradient(680px circle at 8% 12%, rgba(251, 191, 36, 0.22), transparent 50%), radial-gradient(600px circle at 92% 8%, rgba(244, 114, 182, 0.24), transparent 48%), radial-gradient(720px circle at 60% 115%, rgba(56, 189, 248, 0.20), transparent 52%)',
  blue: '#6d28d9',
  blueLight: '#ede9fe',
  accent: '#c2410c',
  accentLight: '#fff7ed',
  bg: '#fbf7fd',
  card: '#ffffff',
  border: '#ece3f6',
  brandLight: '#f7e9ff',
  neutral: '#5c5248',
  neutralBg: '#f1ece6',
  text: '#1a1410',
  textMuted: '#57534e',
  textFaint: '#7b736b',
  success: '#047857',
  successBg: '#ecfdf5',
  warning: '#b45309',
  warningBg: '#fffbeb',
  danger: '#be123c',
  dangerBg: '#fff1f2',
  tierOwner: '#6d28d9',
  tierHouseOwner: '#be185d',
  radius: '18px',
  radiusSm: '12px',
  // softer, more diffuse shadows (lower opacity, larger spread) for less crisp edges
  shadow: '0 1px 2px rgba(76, 29, 149, 0.035), 0 6px 20px rgba(76, 29, 149, 0.06)',
  shadowLg: '0 10px 36px rgba(76, 29, 149, 0.12)'
}

// cheerful color pairs [text, background] for varied chips/badges
// text colors are deepened so each clears WCAG AA (4.5:1) on its tint — readable for older eyes
export const chipPalette = [
  ['#6d28d9', '#ede9fe'], // violet
  ['#be185d', '#fce7f3'], // pink
  ['#c2410c', '#ffedd5'], // orange
  ['#115e59', '#ccfbf1'], // teal
  ['#1d4ed8', '#dbeafe'], // blue
  ['#a16207', '#fef9c3']  // gold
]

// deterministically map any label to a chip color so a given type is always the same hue
export const chipColor = (label = '') => {
  let sum = 0
  for (let i = 0; i < label.length; i++) sum += label.charCodeAt(i)
  return chipPalette[sum % chipPalette.length]
}

export const tierColor = (tier) => {
  switch (tier) {
    case 'Owner': return C.tierOwner
    case 'House Owner': return C.tierHouseOwner
    default: return C.textMuted
  }
}

export const badge = (color, bg) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12.5,
  fontWeight: 700,
  color,
  background: bg,
  borderRadius: 999,
  padding: '4px 12px',
  whiteSpace: 'nowrap'
})

export const card = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: C.radius,
  boxShadow: C.shadow
}

export const button = (variant = 'primary') => {
  const base = {
    border: 'none',
    borderRadius: C.radiusSm,
    padding: '9px 18px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'transform .12s ease, box-shadow .12s ease, opacity .12s ease'
  }
  if (variant === 'primary') return { ...base, background: 'linear-gradient(135deg, #6d28d9, #9333ea)', color: '#fff', boxShadow: '0 6px 18px rgba(124, 58, 237, 0.30)' }
  if (variant === 'secondary') return { ...base, background: C.blueLight, color: C.blue }
  if (variant === 'outline') return { ...base, background: '#fff', color: C.text, border: `1px solid ${C.border}` }
  if (variant === 'success') return { ...base, background: C.success, color: '#fff' }
  if (variant === 'danger') return { ...base, background: C.danger, color: '#fff' }
  return base
}
