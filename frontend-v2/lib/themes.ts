// ─────────────────────────────────────────────────────────────────────────────
// SWTS — Theme Palette  (single source of truth)
//
// Each theme defines:
//   gradient   — page background (multi-stop CSS gradient)
//   glass      — glassmorphism surface styles (rgba + backdrop-blur)
//   text       — typographic hierarchy, tinted to complement the gradient
//   accent     — brand / interactive highlight color
//   profit     — semantic green  (gains, bull signals)
//   loss       — semantic red    (losses, bear signals)
//   warn       — semantic amber  (warnings, paused state)
//   input      — form field colors
//
// Usage:
//   import { THEMES, getTheme, DEFAULT_THEME_ID } from '@/lib/themes'
//   const theme = getTheme('midnight')
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeId = 'light' | 'midnight' | 'aurora' | 'cosmic' | 'ocean'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface Theme {
  id:          ThemeId
  name:        string
  description: string

  /** Page background — multi-stop linear gradient */
  gradient: {
    from:  string   // hex stop 0%
    via:   string   // hex stop 50%
    to:    string   // hex stop 100%
    angle: number   // degrees
    css:   string   // ready-to-use value for `background:` or `style`
  }

  /**
   * Glassmorphism surfaces.
   * Pair with `backdrop-filter: blur(20px) saturate(160%)` in your CSS.
   * All surface values are rgba() strings; shadow is a CSS box-shadow string.
   */
  glass: {
    card:         string  // standard card / panel bg
    panel:        string  // denser panel (sidebar, drawers)
    topbar:       string  // top navigation bar
    border:       string  // default glass border
    borderStrong: string  // hover / active / focus border
    shadow:       string  // card drop shadow
  }

  /**
   * Text hierarchy.
   * Each theme uses tinted whites that are native to the gradient hue —
   * avoids the "cold white dumped on coloured bg" clash.
   */
  text: {
    primary:   string  // headings, key numbers  — high contrast
    secondary: string  // body, descriptions
    muted:     string  // labels, secondary info
    ghost:     string  // disabled, placeholder, dividers
  }

  /**
   * Accent / brand color.
   * Active nav, focused inputs, primary buttons, highlights.
   */
  accent: {
    color:  string  // hex — the accent hue itself
    soft:   string  // rgba — low-opacity tint (button bg, badge bg)
    border: string  // rgba — accent-tinted border
    glow:   string  // CSS box-shadow — for glowing elements (live dot, active card)
  }

  /** Profit — gains, buy signals, BULL direction */
  profit: {
    text:   string  // hex
    bg:     string  // rgba — tag / badge bg
    border: string  // rgba — tag border
    glow:   string  // CSS box-shadow — P&L number glow
  }

  /** Loss — drawdowns, sell signals, BEAR direction */
  loss: {
    text:   string
    bg:     string
    border: string
    glow:   string
  }

  /** Warning — paused engine, soft alerts */
  warn: {
    text:   string
    bg:     string
    border: string
  }

  /** Input / form field colors */
  input: {
    bg:          string  // rgba — field background
    border:      string  // rgba — resting border
    focusBorder: string  // hex  — focused/active border
    focusRing:   string  // rgba — focus ring (ring-2 equivalent)
    text:        string  // hex  — typed text
    placeholder: string  // hex  — placeholder text
  }
}

// ── 1. Midnight ───────────────────────────────────────────────────────────────
// Deep purple-black → indigo.
// Text uses lavender-tinted whites — they sit naturally on the purple hue
// instead of clashing the way pure white does.

const midnight: Theme = {
  id:          'midnight',
  name:        'Midnight',
  description: 'Deep purple-black — classic, premium trading aesthetic',

  gradient: {
    from:  '#0f0c29',
    via:   '#1a1545',
    to:    '#302b63',
    angle: 135,
    css:   'linear-gradient(135deg, #0f0c29 0%, #1a1545 50%, #302b63 100%)',
  },

  glass: {
    // Indigo-tinted glass — cohesive with the purple background
    card:         'rgba(129, 140, 248, 0.06)',
    panel:        'rgba(129, 140, 248, 0.04)',
    topbar:       'rgba(15, 12, 41, 0.75)',
    border:       'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(255, 255, 255, 0.22)',
    shadow:       '0 4px 32px rgba(0, 0, 0, 0.45)',
  },

  text: {
    primary:   '#ede9ff',  // lavender-white — strong contrast, feels native to the palette
    secondary: '#b0a8d8',  // muted lavender — comfortable body text
    muted:     '#6c5fa0',  // dim purple — labels, secondary info
    ghost:     '#3d3566',  // very dark purple — disabled, placeholders
  },

  accent: {
    color:  '#818cf8',                          // indigo-400 — pops on dark purple
    soft:   'rgba(129, 140, 248, 0.15)',
    border: 'rgba(129, 140, 248, 0.38)',
    glow:   '0 0 18px rgba(129, 140, 248, 0.55)',
  },

  profit: {
    text:   '#34d399',                          // emerald-400 — luminous on dark
    bg:     'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.32)',
    glow:   '0 0 14px rgba(52, 211, 153, 0.50)',
  },

  loss: {
    text:   '#f87171',                          // red-400
    bg:     'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.32)',
    glow:   '0 0 14px rgba(248, 113, 113, 0.50)',
  },

  warn: {
    text:   '#fbbf24',                          // amber-400
    bg:     'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.32)',
  },

  input: {
    bg:          'rgba(255, 255, 255, 0.07)',
    border:      'rgba(255, 255, 255, 0.13)',
    focusBorder: '#818cf8',
    focusRing:   'rgba(129, 140, 248, 0.22)',
    text:        '#ede9ff',
    placeholder: '#6c5fa0',
  },
}

// ── 2. Aurora ─────────────────────────────────────────────────────────────────
// Dark ocean-blue → deep forest green.
// Text uses mint/sage-tinted whites — the cool-warm bridge between teal and green.

const aurora: Theme = {
  id:          'aurora',
  name:        'Aurora',
  description: 'Dark teal-to-forest — calm, focused, profit energy',

  gradient: {
    from:  '#0d1b2a',
    via:   '#0f2520',
    to:    '#1b4332',
    angle: 135,
    css:   'linear-gradient(135deg, #0d1b2a 0%, #0f2520 50%, #1b4332 100%)',
  },

  glass: {
    // Teal-tinted glass — cohesive with the teal-green background
    card:         'rgba(45, 212, 191, 0.07)',
    panel:        'rgba(45, 212, 191, 0.04)',
    topbar:       'rgba(13, 27, 42, 0.78)',
    border:       'rgba(255, 255, 255, 0.09)',
    borderStrong: 'rgba(255, 255, 255, 0.20)',
    shadow:       '0 4px 32px rgba(0, 0, 0, 0.48)',
  },

  text: {
    primary:   '#dcfce7',  // green-100 mint-white — crisp and native on dark green
    secondary: '#99d6c0',  // soft sage — harmonious, highly readable
    muted:     '#4aba96',  // medium teal — labels, secondary info
    ghost:     '#2a6b52',  // dark teal — disabled, placeholders
  },

  accent: {
    color:  '#2dd4bf',                          // teal-400 — vivid against dark green
    soft:   'rgba(45, 212, 191, 0.14)',
    border: 'rgba(45, 212, 191, 0.38)',
    glow:   '0 0 18px rgba(45, 212, 191, 0.55)',
  },

  profit: {
    // Brighter green-400 chosen over emerald-400 — needs to stand out on a green bg
    text:   '#4ade80',
    bg:     'rgba(74, 222, 128, 0.12)',
    border: 'rgba(74, 222, 128, 0.32)',
    glow:   '0 0 14px rgba(74, 222, 128, 0.50)',
  },

  loss: {
    text:   '#f87171',
    bg:     'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.32)',
    glow:   '0 0 14px rgba(248, 113, 113, 0.50)',
  },

  warn: {
    text:   '#fbbf24',
    bg:     'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.32)',
  },

  input: {
    bg:          'rgba(255, 255, 255, 0.07)',
    border:      'rgba(255, 255, 255, 0.11)',
    focusBorder: '#2dd4bf',
    focusRing:   'rgba(45, 212, 191, 0.22)',
    text:        '#dcfce7',
    placeholder: '#4aba96',
  },
}

// ── 3. Cosmic ─────────────────────────────────────────────────────────────────
// Near-black → deep violet.
// Text uses violet-300 as the secondary — it's the most complementary colour
// on the Munsell wheel to the background and has superb legibility on near-black.

const cosmic: Theme = {
  id:          'cosmic',
  name:        'Cosmic',
  description: 'Deep violet-black — futuristic, high-energy, sleek',

  gradient: {
    from:  '#0a0015',
    via:   '#120828',
    to:    '#1e0a40',
    angle: 135,
    css:   'linear-gradient(135deg, #0a0015 0%, #120828 50%, #1e0a40 100%)',
  },

  glass: {
    // Violet-tinted glass — cohesive with the near-black violet background
    card:         'rgba(167, 139, 250, 0.07)',
    panel:        'rgba(167, 139, 250, 0.04)',
    topbar:       'rgba(10, 0, 21, 0.82)',
    border:       'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(255, 255, 255, 0.22)',
    shadow:       '0 4px 32px rgba(0, 0, 0, 0.58)',
  },

  text: {
    primary:   '#f3eeff',  // violet-tinted white — very light, strong contrast
    secondary: '#c4b5fd',  // violet-300 — naturally complementary, highly readable on dark violet
    muted:     '#8b70d4',  // medium violet — labels
    ghost:     '#4a2d8a',  // dark violet — disabled, placeholders
  },

  accent: {
    color:  '#a78bfa',                          // violet-400
    soft:   'rgba(167, 139, 250, 0.15)',
    border: 'rgba(167, 139, 250, 0.38)',
    glow:   '0 0 18px rgba(167, 139, 250, 0.58)',
  },

  profit: {
    text:   '#34d399',
    bg:     'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.32)',
    glow:   '0 0 14px rgba(52, 211, 153, 0.50)',
  },

  loss: {
    text:   '#f87171',
    bg:     'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.32)',
    glow:   '0 0 14px rgba(248, 113, 113, 0.50)',
  },

  warn: {
    text:   '#fbbf24',
    bg:     'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.32)',
  },

  input: {
    bg:          'rgba(255, 255, 255, 0.07)',
    border:      'rgba(255, 255, 255, 0.12)',
    focusBorder: '#a78bfa',
    focusRing:   'rgba(167, 139, 250, 0.24)',
    text:        '#f3eeff',
    placeholder: '#8b70d4',
  },
}

// ── 4. Ocean ──────────────────────────────────────────────────────────────────
// Midnight navy — deepest at the bottom (180° vertical gradient).
// Sky-blue tinted whites are the natural text complement for deep navy —
// the same relationship you see in a night sky.

const ocean: Theme = {
  id:          'ocean',
  name:        'Ocean',
  description: 'Midnight navy — clean, professional, Bloomberg-terminal feel',

  gradient: {
    from:  '#0a1628',
    via:   '#071322',
    to:    '#030d1a',
    angle: 180,
    css:   'linear-gradient(180deg, #0a1628 0%, #071322 55%, #030d1a 100%)',
  },

  glass: {
    // Sky-blue-tinted glass — cohesive with the deep navy background
    card:         'rgba(56, 189, 248, 0.06)',
    panel:        'rgba(56, 189, 248, 0.04)',
    topbar:       'rgba(10, 22, 40, 0.82)',
    border:       'rgba(255, 255, 255, 0.09)',
    borderStrong: 'rgba(255, 255, 255, 0.20)',
    shadow:       '0 4px 32px rgba(0, 0, 0, 0.52)',
  },

  text: {
    primary:   '#e0f2fe',  // sky-100 — clean sky-white, native to navy
    secondary: '#7dd3fc',  // sky-300 — vivid but readable, beautiful on dark blue
    muted:     '#3b82c4',  // medium blue — labels, secondary info
    ghost:     '#1e3a5f',  // dark navy — disabled, placeholders
  },

  accent: {
    color:  '#38bdf8',                          // sky-400 — crisp on navy
    soft:   'rgba(56, 189, 248, 0.13)',
    border: 'rgba(56, 189, 248, 0.38)',
    glow:   '0 0 18px rgba(56, 189, 248, 0.52)',
  },

  profit: {
    text:   '#34d399',
    bg:     'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.32)',
    glow:   '0 0 14px rgba(52, 211, 153, 0.50)',
  },

  loss: {
    text:   '#f87171',
    bg:     'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.32)',
    glow:   '0 0 14px rgba(248, 113, 113, 0.50)',
  },

  warn: {
    text:   '#fbbf24',
    bg:     'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.32)',
  },

  input: {
    bg:          'rgba(255, 255, 255, 0.07)',
    border:      'rgba(255, 255, 255, 0.10)',
    focusBorder: '#38bdf8',
    focusRing:   'rgba(56, 189, 248, 0.22)',
    text:        '#e0f2fe',
    placeholder: '#3b82c4',
  },
}

// ── Exports ───────────────────────────────────────────────────────────────────

/** All available themes in display order */
export const THEMES: Theme[] = [midnight, aurora, cosmic, ocean]

/** Theme shown on first load (before user picks one) */
export const DEFAULT_THEME_ID: ThemeId = 'midnight'

/** Look up a theme by id — falls back to midnight if id is unknown */
export function getTheme(id: ThemeId): Theme {
  return THEMES.find(t => t.id === id) ?? midnight
}
