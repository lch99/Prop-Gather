// PropGather design tokens — inline-style usage: import { C } from './theme'
// Brand: Primary Blue #4081C6 · Primary Red #C74B54 (from the PropGather.com logo)
export const C = {
  navy: '#1B3A5C',
  navyDark: '#122A44',
  // clean, confident blue gradient for the sticky header — single-hue depth keeps white nav text crisp
  headerGradient: 'linear-gradient(125deg, #2E5D8F 0%, #4081C6 52%, #5192D2 100%)',
  // a wider gradient used for the animated, shifting hero backdrop
  headerGradientWide: 'linear-gradient(125deg, #2E5D8F 0%, #4081C6 30%, #5192D2 55%, #35659C 80%, #2E5D8F 100%)',
  // warm glow blobs — red brand accent + gold warmth + soft white brighten, present enough to feel joyful
  heroGlow: 'radial-gradient(680px circle at 8% 12%, rgba(199, 75, 84, 0.24), transparent 50%), radial-gradient(600px circle at 92% 8%, rgba(255, 200, 87, 0.22), transparent 48%), radial-gradient(720px circle at 60% 115%, rgba(255, 255, 255, 0.16), transparent 52%)',
  blue: '#4081C6',
  blueLight: '#E7F0FA',
  accent: '#C74B54',
  accentLight: '#FBEAEA',
  bg: '#F7FAFD',
  card: '#ffffff',
  border: '#DCE6F0',
  brandLight: '#DCEAF7',
  neutral: '#57616B',
  neutralBg: '#EEF2F5',
  text: '#20242A',
  textMuted: '#4B5563',
  textFaint: '#6B7280',
  success: '#047857',
  successBg: '#ecfdf5',
  warning: '#b45309',
  warningBg: '#fffbeb',
  danger: '#be123c',
  dangerBg: '#fff1f2',
  tierOwner: '#4081C6',
  tierHouseOwner: '#C74B54',
  radius: '18px',
  radiusSm: '12px',
  // softer, more diffuse shadows (lower opacity, larger spread) for less crisp edges
  shadow: '0 1px 2px rgba(64, 129, 198, 0.04), 0 6px 20px rgba(64, 129, 198, 0.07)',
  shadowLg: '0 10px 36px rgba(64, 129, 198, 0.16)'
}

// cheerful color pairs [text, background] for varied chips/badges
// text colors are deepened so each clears WCAG AA (4.5:1) on its tint — readable for older eyes
export const chipPalette = [
  ['#2F6FB0', '#E7F0FA'], // 0 brand blue
  ['#A83E46', '#FBEAEA'], // 1 brand red
  ['#B45309', '#FEF3C7'], // 2 gold
  ['#0F766E', '#CCFBF1'], // 3 teal
  ['#15803D', '#DCFCE7'], // 4 green
  ['#6D28D9', '#EDE9FE'], // 5 violet
  ['#A21CAF', '#FAE8FF'], // 6 plum
  ['#475569', '#E2E8F0']  // 7 slate
]

// deterministically map any label to a chip color so a given type is always the same hue
export const chipColor = (label = '') => {
  let sum = 0
  for (let i = 0; i < label.length; i++) sum += label.charCodeAt(i)
  return chipPalette[sum % chipPalette.length]
}

// Property types are the one place where several chips sit side by side in the
// same list (Discover cards, the admin directory, the admin type picker), so a
// hash collision reads as a bug — two different types wearing the same colour.
// The types we ship get a fixed, hand-picked slot each; the slots they claim are
// then withheld from the hash below, so an admin-created free-text type can
// never land on top of one of them either.
const typeChipSlot = {
  'Condo': 1,               // brand red
  'Apartment': 0,           // brand blue
  'Serviced Apartment': 5,  // violet
  'Landed G&G': 4,          // green
  'Township': 2             // gold
}

const unclaimedChips = chipPalette.filter((_, i) => !Object.values(typeChipSlot).includes(i))

export const typeChipColor = (type = '') => {
  const slot = typeChipSlot[(type || '').trim()]
  if (slot !== undefined) return chipPalette[slot]
  let sum = 0
  const label = type || ''
  for (let i = 0; i < label.length; i++) sum += label.charCodeAt(i)
  return unclaimedChips[sum % unclaimedChips.length]
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
  if (variant === 'primary') return { ...base, background: 'linear-gradient(135deg, #4081C6, #5192D2)', color: '#fff', boxShadow: '0 6px 18px rgba(64, 129, 198, 0.32)' }
  if (variant === 'secondary') return { ...base, background: C.blueLight, color: C.blue }
  if (variant === 'outline') return { ...base, background: '#fff', color: C.text, border: `1px solid ${C.border}` }
  if (variant === 'accent') return { ...base, background: 'linear-gradient(135deg, #C74B54, #D46B72)', color: '#fff', boxShadow: '0 6px 18px rgba(199, 75, 84, 0.32)' }
  if (variant === 'success') return { ...base, background: C.success, color: '#fff' }
  if (variant === 'danger') return { ...base, background: C.danger, color: '#fff' }
  return base
}
