// Browser side of the home theme (HW-64): state, CSS vars on <html>, live device-mode follow.
// The in-app choice lives in localStorage (Homelable has no per-user prefs; Tom is the only user).
import {
  CATALOG_KEY, CATALOG_URL, CHOICE_KEY, CLAIM_COOKIE, VENDORED,
  effective, findTheme, isCatalog, parseClaim, parseStored, resolveColor, resolveMode, withAlpha,
  type Catalog, type CatalogTheme, type Choice, type Claim, type Effective, type Roles, type Stored,
} from './core'

export interface HomeThemeState {
  catalog: Catalog
  claim: Claim
  stored: Stored | null
  effective: Effective
  theme: CatalogTheme
  resolved: 'light' | 'dark'
  roles: Roles
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* private mode */ } },
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) { try { return decodeURIComponent(v.join('=')) } catch { return null } }
  }
  return null
}

function cachedCatalog(): Catalog {
  try {
    const c = JSON.parse(ls.get(CATALOG_KEY) ?? 'null')
    if (isCatalog(c)) return c
  } catch { /* fall through */ }
  return VENDORED
}

const dark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
const listeners = new Set<() => void>()
let state: HomeThemeState | null = null

function compute(catalog: Catalog): HomeThemeState {
  const claim = parseClaim(readCookie(CLAIM_COOKIE), catalog)
  let stored = parseStored(ls.get(CHOICE_KEY))
  const eff = effective(claim, stored)
  if (eff.stale) { ls.del(CHOICE_KEY); stored = null }
  const theme = findTheme(catalog, eff.theme)
  const resolved = resolveMode(eff.mode, dark())
  return { catalog, claim, stored, effective: eff, theme, resolved, roles: theme.modes[resolved] }
}

function apply(s: HomeThemeState) {
  const root = document.documentElement
  for (const [role, value] of Object.entries(s.roles)) root.style.setProperty(`--hl-${role}`, value)
  for (const [role, value] of Object.entries(s.theme.modes.dark)) root.style.setProperty(`--hl-dark-${role}`, value)
  root.style.colorScheme = s.resolved
  root.dataset.theme = s.resolved
  root.dataset.homeTheme = s.theme.id
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = s.roles.bg
}

export function refresh(catalog?: Catalog) {
  state = compute(catalog ?? state?.catalog ?? cachedCatalog())
  apply(state)
  listeners.forEach((l) => l())
}

export function getState(): HomeThemeState {
  if (!state) refresh()
  return state!
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** null = follow the home theme. A choice records the override it was made against. */
export function setChoice(choice: Choice | null) {
  if (choice) ls.set(CHOICE_KEY, JSON.stringify({ ...choice, basis: getState().claim.override }))
  else ls.del(CHOICE_KEY)
  refresh()
}

/** Current hex for a var(--hl-*) colour (colour pickers, hex math); anything else unchanged. */
export const toHex = <T,>(value: T): T | string =>
  typeof value === 'string' && value.includes('var(--hl-') ? resolveColor(value, getState().roles) : value

// <input type=color> only takes #rrggbb; upstream feeds it theme defaults, now var() strings.
function patchColorInputs() {
  for (const prop of ['value', 'defaultValue'] as const) {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, prop)
    if (!d?.set || !d.get) continue
    Object.defineProperty(HTMLInputElement.prototype, prop, {
      ...d,
      set(this: HTMLInputElement, v: unknown) {
        const hex = this.type === 'color' ? toHex(v) : v
        d.set!.call(this, typeof hex === 'string' && hex.length === 9 ? hex.slice(0, 7) : hex)
      },
    })
  }
}

export function init() {
  const g = globalThis as Record<string, unknown>
  g.__hlA = withAlpha
  g.__hlHex = toHex
  patchColorInputs()
  refresh()
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => refresh())
  window.addEventListener('storage', (e) => { if (e.key === CHOICE_KEY) refresh() })
  // New themes appear without a rebuild; the vendored copy only covers first paint/offline.
  fetch(CATALOG_URL, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => {
      if (!isCatalog(c)) return
      ls.set(CATALOG_KEY, JSON.stringify(c))
      refresh(c)
    })
    .catch(() => { /* offline: keep the cached/vendored catalog */ })
}
