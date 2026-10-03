import { describe, it, expect } from 'vitest'
import { VENDORED, effective, findTheme, parseClaim, parseStored, resolveColor, resolveMode, withAlpha } from '../core'

const claim = (override = 'follow', theme = 'dusk', mode = 'dark' as const) => ({ theme, mode, override })

describe('home theme precedence (HW-62 rules)', () => {
  it('no in-app choice: the claim', () => {
    expect(effective(claim(), null)).toEqual({ theme: 'dusk', mode: 'dark', source: 'home', stale: false })
  })
  it('in-app choice made against the current override wins (a global change does not undo it)', () => {
    const stored = { theme: 'lime', mode: 'light' as const, basis: 'follow' }
    expect(effective(claim('follow', 'gold'), stored)).toEqual({ theme: 'lime', mode: 'light', source: 'app', stale: false })
  })
  it('per-app override changed in authentik (incl. back to follow): claim wins, choice is stale', () => {
    const stored = { theme: 'lime', mode: 'light' as const, basis: 'follow' }
    expect(effective(claim('ink/dark', 'ink'), stored)).toMatchObject({ theme: 'ink', source: 'home', stale: true })
    expect(effective(claim('follow'), { ...stored, basis: 'ink/dark' })).toMatchObject({ theme: 'dusk', stale: true })
  })
})

describe('claim / stored parsing', () => {
  it('missing or malformed claim -> slate / automatic / follow', () => {
    expect(parseClaim(null)).toEqual({ theme: 'slate', mode: 'automatic', override: 'follow' })
    expect(parseClaim('{bad')).toEqual({ theme: 'slate', mode: 'automatic', override: 'follow' })
    expect(parseClaim('{"theme":"rave","mode":"sideways"}')).toEqual({ theme: 'rave', mode: 'automatic', override: 'follow' })
  })
  it('stored choice needs theme, mode and basis', () => {
    expect(parseStored('{"theme":"rave","mode":"dark","basis":"follow"}')).toEqual({ theme: 'rave', mode: 'dark', basis: 'follow' })
    expect(parseStored('{"theme":"rave","mode":"dark"}')).toBeNull()
    expect(parseStored('nope')).toBeNull()
  })
  it('unknown theme id -> default theme', () => {
    expect(findTheme(VENDORED, 'no-such-theme').id).toBe('slate')
    expect(findTheme(VENDORED, 'dusk').id).toBe('dusk')
  })
  it('automatic follows the device', () => {
    expect(resolveMode('automatic', true)).toBe('dark')
    expect(resolveMode('automatic', false)).toBe('light')
    expect(resolveMode('light', true)).toBe('light')
  })
})

describe('colour helpers', () => {
  const roles = { primary: '#8DB0BD', hero: 'linear-gradient(#000,#fff)' }
  it('resolves var / color-mix to hex for colour pickers and hex math', () => {
    expect(resolveColor('var(--hl-primary)', roles)).toBe('#8db0bd')
    expect(resolveColor('color-mix(in srgb,var(--hl-primary) 50%,transparent)', roles)).toBe('#8db0bd80')
    expect(resolveColor('#123456', roles)).toBe('#123456')
    expect(resolveColor('var(--hl-hero)', roles)).toBe('var(--hl-hero)')
  })
  it('alpha suffix: hex unchanged, var -> color-mix', () => {
    expect(withAlpha('#a855f7', '44')).toBe('#a855f744')
    expect(withAlpha('var(--hl-lit)', '80')).toBe('color-mix(in srgb,var(--hl-lit) 50.2%,transparent)')
  })
  it('every vendored theme has every role in both modes', () => {
    const roles = Object.keys(VENDORED.themes[0].modes.dark)
    for (const t of VENDORED.themes) for (const m of ['light', 'dark'] as const) expect(Object.keys(t.modes[m]).sort()).toEqual([...roles].sort())
  })
})
