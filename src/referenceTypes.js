import { msg } from './i18n.jsx'

// Reference categories shown in the admin uploader and the resident References tab.
// Each [text, background] color pair is WCAG-AA legible (matches theme.chipPalette).
// `key` is the value the server stores; the References tab translates it for display.
export const REFERENCE_TYPES = [
  { key: msg('Project Reference'), icon: '🏢', color: ['#A83E46', '#FBEAEA'], hint: 'Community-wide: brochures, site plans, facilities' },
  { key: msg('Residence Reference'), icon: '🏠', color: ['#2F6FB0', '#E7F0FA'], hint: 'Unit-level: floor plans, your-unit documents' },
  { key: msg('Building Progress'), icon: '🏗️', color: ['#B45309', '#FEF3C7'], hint: 'Construction / upgrade updates with progress' }
]

export const PROGRESS_TYPE = 'Building Progress'

export const refMeta = (type) =>
  REFERENCE_TYPES.find(t => t.key === type) || REFERENCE_TYPES[0]
