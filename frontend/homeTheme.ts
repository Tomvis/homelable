// Home theme (HW-48 build remap, runtime-themeable since HW-64; Tomvis fork only).
// Upstream hardcodes a GitHub-dark palette in hundreds of places. Rather than touching components
// (rebases stay clean), the build maps those literals to `var(--hl-<role>)`, and
// src/homeTheme/runtime.ts sets the vars from the theme catalog for the user's theme × mode.
//  - CSS: declaration values only; selectors (escaped `\#hex`) and so class names stay upstream's.
//    Tailwind folds `bg-[#hex]/10` into a constant `oklab(... / .1)`; those become color-mix().
//  - JS (per src module): string colours outside class tokens (inline styles, theme presets, SVG attributes).
//    `#hexAA` / `rgba(r,g,b,a)` become color-mix(); upstream's `${color}44` alpha suffix goes
//    through __hlA(), and colorUtils' hex math through __hlHex(), both defined by runtime.ts.
// Unmapped colours (node-type palette, rack hardware, user picks) pass through untouched.
import type { Plugin } from 'vite'

/** Upstream hex -> home role. */
export const HOME_ROLE: Record<string, string> = {
  '0d1117': 'bg', // base
  '010409': 'bg', // walkthrough scrim
  '161b22': 'surface', // elevated
  '21262d': 'surface-2', // card
  '30363d': 'border',
  '484f58': 'border-strong',
  '6e7681': 'text-disabled',
  '8b949e': 'text-disabled', // muted text
  'c9d1d9': 'text-2',
  'e6edf3': 'text',
  '00d4ff': 'primary', // cyan is "on right now" only; upstream's cyan accent = primary
  '22d3ee': 'primary',
  '00b8e0': 'primary', // primary hover
  '39d353': 'lit', // online = the one live state
  'f85149': 'alarm',
  'ffa198': 'alarm',
  'e3b341': 'warning',
}
// Same colour, different job: dark text on a cyan button is on-primary, not bg.
const ROLE_BY_PROP: Record<string, Record<string, string>> = {
  color: { '0d1117': 'on-primary' },
}

const pct = (a: number) => `${Math.round(a * 1000) / 10}%`
const v = (role: string) => `var(--hl-${role})`
const mix = (role: string, a: number) => `color-mix(in srgb,${v(role)} ${pct(a)},transparent)`

function roleOf(hex: string, prop?: string): string | undefined {
  const h = hex.toLowerCase()
  return (prop && ROLE_BY_PROP[prop]?.[h]) || HOME_ROLE[h]
}

/** `#hex` / `#hexAA` -> var()/color-mix(), or null if unmapped. */
function mapHex(hex: string, alpha: string | undefined, prop?: string): string | null {
  const role = roleOf(hex, prop)
  if (!role) return null
  return alpha ? mix(role, parseInt(alpha, 16) / 255) : v(role)
}

const RGB_HEX = new Map(Object.keys(HOME_ROLE).map((h) => [
  [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(','), h,
]))
const HEX = '([0-9a-fA-F]{6})([0-9a-fA-F]{2})?(?![0-9a-zA-Z_-])'
const RGBA_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+%?)\s*)?\)/g

function mapRgba(code: string, prop?: string): string {
  return code.replace(RGBA_RE, (m, r, g, b, a?: string) => {
    const hex = RGB_HEX.get(`${r},${g},${b}`)
    const role = hex && roleOf(hex, prop)
    if (!role) return m
    const alpha = a === undefined ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a)
    return alpha >= 1 ? v(role) : mix(role, alpha)
  })
}

// ---------- CSS ----------

const CSS_HEX_RE = new RegExp(`(?<!\\\\)#${HEX}`, 'g')
const SEL_HEX_RE = /\\#([0-9a-fA-F]{6})\\\]\\\/(\d+)/ // .bg-\[\#00d4ff\]\/10
const FOLDED_RE = /okl(?:ab|ch)\([^()]*\/\s*([\d.]+%?)\s*\)/g

function mapDeclarations(decls: string): string {
  return decls.replace(/(^|;)(\s*)([-\w]+)(\s*:)([^;]*)/g, (_m, sep, ws, prop: string, colon, value: string) => {
    const p = prop.toLowerCase()
    const out = mapRgba(value.replace(CSS_HEX_RE, (h, hex, a) => mapHex(hex, a, p) ?? h), p)
    return sep + ws + prop + colon + out
  })
}

/** Remap colour values in a stylesheet; selectors are left alone. */
export function remapCss(css: string): string {
  return css.replace(/([^{}]*)\{([^{}]*)\}/g, (m, sel: string, decls: string) => {
    if (/^\s*@/.test(sel.split(/[;}]/).pop() ?? '')) return m // @font-face etc.: no colours
    const folded = SEL_HEX_RE.exec(sel)
    const role = folded && roleOf(folded[1])
    let body = decls
    if (role) {
      body = body.replace(FOLDED_RE, (_f, a: string) => mix(role, a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a)))
    }
    return `${sel}{${mapDeclarations(body)}}`
  })
}

// ---------- JS ----------

// Not inside a Tailwind class token like `bg-[#hex]` / `shadow-[0_0_8px_#hexAA]` (CSS maps those).
const JS_HEX_RE = new RegExp(`(?<!\\[[^\\]\\s"'\`]*)(?<![\\\\&])#${HEX}`, 'g')
const PROP_BEFORE_RE = /(?:^|[^\w-])(color|fill|stroke|background(?:Color)?|border(?:Color)?)\s*:\s*["'`]$/

/** Remap colour literals in emitted JS; `fonts` also renames inline font stacks. */
export function remapJs(code: string, fonts = false): string {
  let out = code.replace(JS_HEX_RE, (h, hex: string, a: string | undefined, offset: number) => {
    const prop = PROP_BEFORE_RE.exec(code.slice(Math.max(0, offset - 24), offset))?.[1]
    return mapHex(hex, a, prop) ?? h
  })
  out = mapRgba(out)
  if (fonts) out = out.replace(FONT_RE, '$1Rubik$1')
  return out
}
const FONT_RE = /(?<![\w-])(['"]?)(?:Inter Variable|Inter|JetBrains Mono)\1(?=\s*,)/g

/** `${expr}44` in a template literal -> `${__hlA(expr,"44")}` (a no-op for real hex colours). */
export function wrapAlphaSuffix(code: string): string {
  return code.replace(/\$\{([^{}`]+)\}([0-9a-fA-F]{2})(?![0-9a-zA-Z_-])/g, (_m, expr: string, aa: string) =>
    `\${globalThis.__hlA(${expr},"${aa}")}`)
}

const COLOR_UTILS_RE = /export function (hexToRgba|applyOpacity)\((\w+)([^)]*)\)\s*\{/g

/** colorUtils parses hex; resolve var() colours to the current theme's hex first. */
export function patchColorUtils(code: string): string {
  let n = 0
  const out = code.replace(COLOR_UTILS_RE, (m, _fn, arg: string) => {
    n++
    return `${m} ${arg} = globalThis.__hlHex ? globalThis.__hlHex(${arg}) : ${arg};`
  })
  if (n !== 2) throw new Error('home-theme: colorUtils hexToRgba/applyOpacity not found (upstream changed?)')
  return out
}

// Upstream's official logo keeps its own colours (HW-58); only the wordmark, which sits on the
// app chrome, stays readable in light mode ("Home" = text, "lable" = a darker cyan in light).
const LOGO_MODULE_RE = /\/src\/components\/ui\/Logo\.tsx$/
export const remapLogo = (code: string) => code
  .replace(/(?<!\w)(color:\s*)(["'])#e6edf3\2/i, '$1$2var(--hl-text)$2')
  .replace(/(?<!\w)(color:\s*)(["'])#00d4ff\2/i, '$1$2light-dark(#007f9c, #00d4ff)$2')
const SRC_RE = /\/src\/.*\.[jt]sx?$/

export function homeTheme(): Plugin[] {
  return [
    {
      // Dev too: the runtime sets the vars; only the literal remap below is build-only.
      name: 'home-theme-boot',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace(
          /(\s*)<script type="module" src="\/src\/main\.tsx"><\/script>/,
          '$1<script type="module" src="/src/homeTheme/boot.ts"></script>$&',
        ),
      },
    },
    {
      name: 'home-theme',
      apply: 'build',
      enforce: 'post',
      // Per module (not the final chunk), so node_modules and the theme catalog stay untouched.
      transform(code, id) {
        const file = id.split('?')[0]
        if (LOGO_MODULE_RE.test(file)) return { code: remapLogo(code), map: null }
        if (!SRC_RE.test(file) || file.includes('/src/homeTheme/')) return null
        let out = remapJs(wrapAlphaSuffix(code), true)
        if (file.endsWith('/src/utils/colorUtils.ts')) out = patchColorUtils(out)
        return out === code ? null : { code: out, map: null }
      },
      generateBundle(_opts, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type === 'asset' && file.fileName.endsWith('.css') && typeof file.source === 'string') {
            file.source = remapCss(file.source)
          }
        }
      },
    },
  ]
}
