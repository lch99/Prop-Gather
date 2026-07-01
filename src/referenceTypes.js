// Reference categories shown in the admin uploader and the resident References tab.
// Each [text, background] color pair is WCAG-AA legible (matches theme.chipPalette).
export const REFERENCE_TYPES = [
  { key: 'Project Reference', icon: '🏢', color: ['#6d28d9', '#ede9fe'], hint: 'Community-wide: brochures, site plans, facilities' },
  { key: 'Residence Reference', icon: '🏠', color: ['#1d4ed8', '#dbeafe'], hint: 'Unit-level: floor plans, your-unit documents' },
  { key: 'Building Progress', icon: '🏗️', color: ['#c2410c', '#ffedd5'], hint: 'Construction / upgrade updates with progress' }
]

export const PROGRESS_TYPE = 'Building Progress'

export const refMeta = (type) =>
  REFERENCE_TYPES.find(t => t.key === type) || REFERENCE_TYPES[0]
