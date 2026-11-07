// Mermaid diagrams in documents (HW-302, Tomvis fork only). The library is a separate chunk,
// loaded the first time a document holds a ```mermaid fence.
import type { Mermaid, MermaidConfig } from 'mermaid'

import type { HomeThemeState } from '@/homeTheme/runtime'

let loading: Promise<Mermaid> | null = null

export function loadMermaid(): Promise<Mermaid> {
  loading ??= import('mermaid').then((m) => m.default).catch((e) => {
    loading = null // a failed chunk fetch is retried on the next diagram
    throw e
  })
  return loading
}

let seq = 0
/** Render ids double as DOM ids and CSS selectors inside the svg: letters, digits, dashes. */
export const nextRenderId = () => `hl-mermaid-${++seq}`

const HEX = /^#[0-9a-f]{6}$/i

/** Mermaid's colour maths needs real colours, so the theme's current hex values, not var(--hl-*). */
export function mermaidConfig(theme: Pick<HomeThemeState, 'resolved' | 'roles'>): MermaidConfig {
  const pick = (...roles: string[]) => roles.map((r) => theme.roles[r]).find((v) => v && HEX.test(v))
  const vars: Record<string, string | undefined> = {
    background: pick('bg'),
    primaryColor: pick('surface-2'),
    primaryTextColor: pick('text'),
    primaryBorderColor: pick('border-strong', 'border'),
    secondaryColor: pick('surface'),
    secondaryTextColor: pick('text'),
    secondaryBorderColor: pick('border'),
    tertiaryColor: pick('bg'),
    tertiaryTextColor: pick('text'),
    tertiaryBorderColor: pick('border'),
    lineColor: pick('text-2'),
    textColor: pick('text'),
    titleColor: pick('text'),
    nodeTextColor: pick('text'),
    clusterBkg: pick('surface'),
    clusterBorder: pick('border'),
    edgeLabelBackground: pick('surface'),
    noteBkgColor: pick('surface'),
    noteTextColor: pick('text'),
    noteBorderColor: pick('border'),
    actorBkg: pick('surface-2'),
    actorBorder: pick('border-strong', 'border'),
    actorTextColor: pick('text'),
    signalColor: pick('text-2'),
    signalTextColor: pick('text'),
    errorBkgColor: pick('alarm'),
    errorTextColor: pick('on-primary'),
  }
  const font = typeof document !== 'undefined' ? getComputedStyle(document.body).fontFamily : ''
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    suppressErrorRendering: true,
    theme: 'base',
    darkMode: theme.resolved === 'dark',
    fontFamily: font || 'Inter Variable, Inter, sans-serif',
    themeVariables: Object.fromEntries(Object.entries(vars).filter(([, v]) => v)),
  }
}

/** One line of a mermaid error. Parse errors keep the offending token, not the caret drawing. */
export function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  let line = msg.split('\n').find((l) => l.trim())?.trim() ?? 'unknown error'
  const got = /\bgot '([^']*)'/.exec(msg)?.[1]
  if (got && line.endsWith(':')) line = `${line} unexpected ${got}`
  return line.length > 200 ? `${line.slice(0, 199)}…` : line
}
