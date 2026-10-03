// Home theme runtime (HW-64, Tomvis fork only). The build (../../homeTheme.ts) turns upstream's
// hardcoded palette into `var(--hl-<role>)`; this module picks the theme × mode and sets those
// vars. Choice = the authentik claim (cookie set at OIDC login), unless an in-app choice made
// against the same per-app override exists (HW-62 precedence, same as home-monitoring theme_sync).
import vendored from './catalog.json'

export type Mode = 'automatic' | 'light' | 'dark'
export type Roles = Record<string, string>
export interface CatalogTheme {
  id: string
  name: string
  description?: string
  designed_as?: string
  modes: { light: Roles; dark: Roles }
}
export interface Catalog { default: string; themes: CatalogTheme[] }
export interface Claim { theme: string; mode: Mode; override: string }
export interface Choice { theme: string; mode: Mode }
export interface Stored extends Choice { basis: string }
export interface Effective extends Choice { source: 'app' | 'home'; stale: boolean }

export const CATALOG_URL = 'https://theme.leratom.cloud/dist/themes/all.json'
export const CLAIM_COOKIE = 'homelable-home-theme'
export const CHOICE_KEY = 'homelable-home-theme-choice'
export const CATALOG_KEY = 'homelable-home-theme-catalog'
export const VENDORED = vendored as Catalog
const MODES: Mode[] = ['automatic', 'light', 'dark']

const isMode = (m: unknown): m is Mode => MODES.includes(m as Mode)
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

export function isCatalog(c: unknown): c is Catalog {
  const t = (c as Catalog | null)?.themes
  return Array.isArray(t) && t.length > 0 && t.every((x) => str(x?.id) && x.modes?.light?.bg && x.modes?.dark?.bg)
}

/** Claim from the cookie value; anything missing or malformed falls back to slate/automatic/follow. */
export function parseClaim(raw: string | null | undefined, catalog: Catalog = VENDORED): Claim {
  let c: Record<string, unknown> = {}
  try { c = raw ? JSON.parse(raw) : {} } catch { c = {} }
  return {
    theme: str(c?.theme) ?? catalog.default,
    mode: isMode(c?.mode) ? c.mode : 'automatic',
    override: str(c?.override) ?? 'follow',
  }
}

export function parseStored(raw: string | null | undefined): Stored | null {
  try {
    const s = raw ? JSON.parse(raw) : null
    return s && str(s.theme) && isMode(s.mode) && str(s.basis) ? { theme: s.theme, mode: s.mode, basis: s.basis } : null
  } catch { return null }
}

/** HW-62: the in-app choice wins only while the per-app override it was made against is unchanged. */
export function effective(claim: Claim, stored: Stored | null): Effective {
  if (stored && stored.basis === claim.override) return { theme: stored.theme, mode: stored.mode, source: 'app', stale: false }
  return { theme: claim.theme, mode: claim.mode, source: 'home', stale: stored !== null }
}

export function findTheme(catalog: Catalog, id: string): CatalogTheme {
  return catalog.themes.find((t) => t.id === id)
    ?? catalog.themes.find((t) => t.id === catalog.default)
    ?? catalog.themes[0]
}

export const resolveMode = (mode: Mode, prefersDark: boolean): 'light' | 'dark' =>
  mode === 'automatic' ? (prefersDark ? 'dark' : 'light') : mode

/** `var(--hl-x)` / `color-mix(in srgb,var(--hl-x) N%,transparent)` -> hex(8) from `roles`. */
export function resolveColor(value: string, roles: Roles): string {
  const m = /var\(--hl-([\w-]+)\)/.exec(value)
  const hex = m ? roles[m[1]] : undefined
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return value
  let alpha = 1
  for (const p of value.matchAll(/\)\s+([\d.]+)%/g)) alpha *= Number(p[1]) / 100
  return alpha >= 1 ? hex.toLowerCase() : hex.toLowerCase() + Math.round(alpha * 255).toString(16).padStart(2, '0')
}

/** Upstream's `${color}44` alpha suffix, made safe for var() colours. */
export function withAlpha(color: unknown, aa: string): string {
  if (typeof color === 'string' && color.includes('var(--hl-')) {
    const pct = Math.round((parseInt(aa, 16) / 255) * 1000) / 10
    return `color-mix(in srgb,${color} ${pct}%,transparent)`
  }
  return `${color}${aa}`
}
