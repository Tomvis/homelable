import { describe, it, expect } from 'vitest'
import { patchColorUtils, remapCss, remapJs, remapLogo, wrapAlphaSuffix } from '../../homeTheme'

describe('home theme build remap (HW-48/HW-64)', () => {
  it('CSS: values become role vars, selectors (and so class names) stay upstream', () => {
    expect(remapCss('.bg-\\[\\#00d4ff\\]{background-color:#00d4ff}'))
      .toBe('.bg-\\[\\#00d4ff\\]{background-color:var(--hl-primary)}')
    expect(remapCss(':root{--primary:#00D4FF;--border:#30363d}')).toBe(':root{--primary:var(--hl-primary);--border:var(--hl-border)}')
  })
  it('CSS: Tailwind-folded opacity utilities become color-mix', () => {
    expect(remapCss('.hover\\:bg-\\[\\#39d353\\]\\/25:hover{background-color:oklab(76.188% -.175058 .119788 / .25)}'))
      .toBe('.hover\\:bg-\\[\\#39d353\\]\\/25:hover{background-color:color-mix(in srgb,var(--hl-lit) 25%,transparent)}')
    expect(remapCss('.bg-\\[\\#a855f7\\]\\/20{background-color:oklab(62% .1 -.2 / .2)}'))
      .toBe('.bg-\\[\\#a855f7\\]\\/20{background-color:oklab(62% .1 -.2 / .2)}')
  })
  it('CSS: alpha hexes, rgba tuples, on-primary text', () => {
    expect(remapCss('.a{box-shadow:0 0 8px #00d4ff80;background:rgba(13,17,23,.5)}'))
      .toBe('.a{box-shadow:0 0 8px color-mix(in srgb,var(--hl-primary) 50.2%,transparent);background:color-mix(in srgb,var(--hl-bg) 50%,transparent)}')
    expect(remapCss('.text-\\[\\#0d1117\\]{color:#0d1117}')).toBe('.text-\\[\\#0d1117\\]{color:var(--hl-on-primary)}')
    expect(remapCss('.x{color:#a855f7}@font-face{font-family:X;src:url(a.woff2)}')).toBe('.x{color:#a855f7}@font-face{font-family:X;src:url(a.woff2)}')
  })
  it('JS: string colours remap, class tokens do not', () => {
    expect(remapJs('{className:"bg-[#00d4ff]/10 shadow-[0_0_8px_#00d4ff66]",style:{border:"1px solid #30363d"}}'))
      .toBe('{className:"bg-[#00d4ff]/10 shadow-[0_0_8px_#00d4ff66]",style:{border:"1px solid var(--hl-border)"}}')
    expect(remapJs('{background: "#00d4ff", color: "#0d1117", fill:"#0d1117"}'))
      .toBe('{background: "var(--hl-primary)", color: "var(--hl-on-primary)", fill:"var(--hl-bg)"}')
    expect(remapJs('x=["#39d353","#a855f7","#f8514922"]'))
      .toBe('x=["var(--hl-lit)","#a855f7","color-mix(in srgb,var(--hl-alarm) 13.3%,transparent)"]')
    expect(remapJs('"rgba(0, 212, 255, 0.3)"')).toBe('"color-mix(in srgb,var(--hl-primary) 30%,transparent)"')
  })
  it('JS: font stacks stay upstream (HW-67)', () => {
    const js = `{fontFamily:'Inter, sans-serif'};x='"JetBrains Mono", monospace'`
    expect(remapJs(js)).toBe(js)
  })
  it('alpha suffixes go through the runtime helper', () => {
    expect(wrapAlphaSuffix('`0 0 8px ${c.border}44`')).toBe('`0 0 8px ${globalThis.__hlA(c.border,"44")}`')
    expect(wrapAlphaSuffix('`${n}px ${a}-${b}`')).toBe('`${n}px ${a}-${b}`')
  })
  it('colorUtils gets its hex parsing guarded, or the build fails loudly', () => {
    const src = 'export function hexToRgba(hex) {\n}\nexport function applyOpacity(hex, opacity) {\n}'
    expect(patchColorUtils(src)).toContain('applyOpacity(hex, opacity) { hex = globalThis.__hlHex')
    expect(() => patchColorUtils('export function other(x) {}')).toThrow(/colorUtils/)
  })
  it('logo: only the wordmark adapts', () => {
    expect(remapLogo(`{stopColor: "#00d4ff"}{color: '#e6edf3'}{color: "#00d4ff"}{fill:"#00d4ff"}`))
      .toBe(`{stopColor: "#00d4ff"}{color: 'var(--hl-text)'}{color: "light-dark(#007f9c, #00d4ff)"}{fill:"#00d4ff"}`)
  })
})
