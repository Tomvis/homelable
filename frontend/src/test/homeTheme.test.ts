import { describe, it, expect } from 'vitest'
import { remapHome } from '../../homeTheme'

describe('home theme remap (HW-48)', () => {
  it('rewrites class strings and their escaped selectors identically', () => {
    expect(remapHome('bg-[#00d4ff]/10 text-[#0D1117]')).toBe('bg-[#8db0bd]/10 text-[#16222a]')
    expect(remapHome('.bg-\\[\\#00d4ff\\]{background:#00d4ff}')).toBe('.bg-\\[\\#8db0bd\\]{background:#8db0bd}')
  })
  it('keeps an alpha suffix and leaves longer/other hexes alone', () => {
    expect(remapHome('#00d4ff20')).toBe('#8db0bd20')
    expect(remapHome('#00d4ff2')).toBe('#00d4ff2')
    expect(remapHome('#a855f7 #ff6e00')).toBe('#a855f7 #ff6e00')
  })
  it('maps online green to lit cyan and rgb tuples', () => {
    expect(remapHome('#39d353')).toBe('#14d9c4')
    expect(remapHome('rgba(0, 212, 255, 0.3) rgb(13,17,23)')).toBe('rgba(141, 176, 189, 0.3) rgb(22, 34, 42)')
  })
  it('renames inline font stacks only when asked', () => {
    const js = `{fontFamily:'Inter, sans-serif'};x='"JetBrains Mono", monospace';y='Inter (sans-serif)'`
    expect(remapHome(js, true)).toBe(`{fontFamily:'Rubik, sans-serif'};x='"Rubik", monospace';y='Inter (sans-serif)'`)
    expect(remapHome(js)).toBe(js)
  })
})
