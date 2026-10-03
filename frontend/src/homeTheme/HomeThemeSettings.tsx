// Settings > Theme (HW-64): every catalog theme × mode, plus "Follow home theme" (the default).
import { useSyncExternalStore } from 'react'
import type { Mode } from './core'
import { getState, setChoice, subscribe } from './runtime'

const MODE_LABEL: Record<Mode, string> = { automatic: 'Auto', light: 'Light', dark: 'Dark' }
const MODES = Object.keys(MODE_LABEL) as Mode[]

export function HomeThemeSettings() {
  const s = useSyncExternalStore(subscribe, getState)
  const following = s.effective.source === 'home'
  const homeName = s.catalog.themes.find((t) => t.id === s.claim.theme)?.name ?? s.claim.theme
  const pill = (on: boolean) =>
    `rounded-md border px-2.5 py-1.5 text-xs transition-colors ${on
      ? 'border-[var(--hl-primary)] bg-[var(--hl-surface-2)] text-[var(--hl-text)]'
      : 'border-[var(--hl-border)] text-[var(--hl-text-disabled)] hover:text-[var(--hl-text)]'}`

  return (
    <section className="space-y-2.5 pb-4 border-b border-border" aria-label="Theme">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Theme</span>
      <button type="button" aria-pressed={following} onClick={() => setChoice(null)} className={`${pill(following)} w-full text-left`}>
        Follow home theme
        <span className="block text-[11px] text-[var(--hl-text-disabled)]">
          {homeName} · {MODE_LABEL[s.claim.mode]} (your choice in authentik)
        </span>
      </button>
      <div className="flex gap-1.5" role="group" aria-label="Mode">
        {MODES.map((m) => (
          <button key={m} type="button" aria-pressed={!following && s.effective.mode === m}
            onClick={() => setChoice({ theme: s.effective.theme, mode: m })}
            className={`${pill(!following && s.effective.mode === m)} flex-1`}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" role="group" aria-label="Themes">
        {s.catalog.themes.map((t) => {
          const r = t.modes[s.resolved]
          const on = !following && s.theme.id === t.id
          return (
            <button key={t.id} type="button" aria-pressed={on} title={t.description}
              onClick={() => setChoice({ theme: t.id, mode: s.effective.mode })}
              className={`${pill(on)} flex items-center gap-2 text-left`}>
              <span className="flex h-4 w-7 shrink-0 overflow-hidden rounded-sm border border-[var(--hl-border)]" aria-hidden>
                {[r.bg, r['surface-2'], r.primary, r.lit].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
              </span>
              <span className="truncate">{t.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
