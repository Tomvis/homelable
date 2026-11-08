// HW-302: ```mermaid fences render as diagrams, themed from the home theme.
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }))
vi.mock('mermaid', () => ({ default: mermaid }))

const theme = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const make = (resolved: 'light' | 'dark', bg: string) => ({
    resolved,
    roles: {
      bg, surface: '#111111', 'surface-2': '#222222', text: '#eeeeee', 'text-2': '#cccccc',
      border: '#333333', 'border-strong': '#444444', primary: '#8db0bd', alarm: '#ff8aa0',
      warning: '#f5b14c', success: '#36e0a0', lit: '#14d9c4', 'on-primary': '#16222a',
    },
  })
  let state = make('dark', '#16222a')
  return {
    getState: () => state,
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } },
    set(resolved: 'light' | 'dark', bg: string) { state = make(resolved, bg); listeners.forEach((l) => l()) },
    reset() { state = make('dark', '#16222a') },
  }
})
vi.mock('@/homeTheme/runtime', () => ({ getState: theme.getState, subscribe: theme.subscribe }))

import { Markdown } from '../markdown/Markdown'
import { clearDrawnCache } from '../markdown/mermaid'

const FENCE = '```mermaid\nflowchart LR\n  a --> b\n```'

beforeEach(() => {
  theme.reset()
  clearDrawnCache()
  mermaid.initialize.mockReset()
  mermaid.render.mockReset()
  mermaid.render.mockImplementation(async (id: string) => ({ svg: `<svg id="${id}" data-testid="diagram"><g/></svg>` }))
})

describe('Markdown — mermaid diagrams', () => {
  it('draws a mermaid fence as an svg', async () => {
    const { container } = render(<Markdown body={FENCE} />)
    expect(await screen.findByTestId('diagram')).toBeInTheDocument()
    expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), 'flowchart LR\n  a --> b')
    expect(container.querySelector('code.language-mermaid')).toBeNull()
  })

  it('initialises mermaid strict, without auto start or html labels', async () => {
    render(<Markdown body={FENCE} />)
    await screen.findByTestId('diagram')
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({
      startOnLoad: false, securityLevel: 'strict', htmlLabels: false, suppressErrorRendering: true, theme: 'base',
    }))
  })

  it('gives every diagram its own render id', async () => {
    render(<Markdown body={`${FENCE}\n\n${FENCE}`} />)
    await waitFor(() => expect(screen.getAllByTestId('diagram')).toHaveLength(2))
    const ids = mermaid.render.mock.calls.map((c) => c[0] as string)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][\w-]*$/)
  })

  it('falls back to the source and a short error when mermaid cannot render it', async () => {
    mermaid.render.mockRejectedValue(new Error("Parse error on line 2:\n...a -->\n-----^\nExpecting 'NODE', got 'EOF'"))
    const { container } = render(<Markdown body={'```mermaid\nflowchart LR\n  a -->\n```\n\nafter'} />)
    expect(await screen.findByText(/Parse error on line 2: unexpected EOF$/)).toBeInTheDocument()
    expect(screen.queryByText(/Expecting NODE/)).toBeNull()
    expect(container.querySelector('pre code')?.textContent).toBe('flowchart LR\n  a -->')
    expect(screen.getByText('after')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('falls back when the mermaid chunk itself throws', async () => {
    mermaid.initialize.mockImplementation(() => { throw new Error('boom') })
    render(<Markdown body={FENCE} />)
    expect(await screen.findByText(/boom/)).toBeInTheDocument()
  })

  it('leaves other code blocks alone and never loads mermaid for them', async () => {
    const { container } = render(<Markdown body={'```ts\nconst a = 1\n```\n\n`inline`'} />)
    const code = container.querySelector('pre > code')
    expect(code?.textContent).toBe('const a = 1\n')
    expect(code).toHaveClass('font-mono', 'text-xs')
    expect(screen.getByText('inline').tagName).toBe('CODE')
    await act(async () => { await Promise.resolve() })
    expect(mermaid.render).not.toHaveBeenCalled()
    expect(mermaid.initialize).not.toHaveBeenCalled()
  })

  it('themes the diagram from the home theme vars', async () => {
    render(<Markdown body={FENCE} />)
    await screen.findByTestId('diagram')
    const cfg = mermaid.initialize.mock.calls.at(-1)![0]
    expect(cfg.darkMode).toBe(true)
    expect(cfg.themeVariables).toMatchObject({
      background: '#16222a', primaryColor: '#222222', primaryTextColor: '#eeeeee',
      primaryBorderColor: '#444444', lineColor: '#cccccc', textColor: '#eeeeee',
    })
  })

  it('keeps the drawn svg when a parent re-render remounts the diagram', async () => {
    // Markdown's components memo follows unstable parent props, so `pre` is a new component type
    // on such a render and the diagram remounts. Live: ~6 redraws/s with Settings open (11-08).
    const { rerender, container } = render(<Markdown body={FENCE} onOpenDoc={() => {}} />)
    await screen.findByTestId('diagram')
    rerender(<Markdown body={FENCE} onOpenDoc={() => {}} />)
    expect(screen.getByTestId('diagram')).toBeInTheDocument()
    expect(container.querySelector('code.language-mermaid')).toBeNull()
    await act(async () => { await Promise.resolve() })
    expect(mermaid.render).toHaveBeenCalledTimes(1)
  })

  it('reuses a theme it already drew instead of drawing it again', async () => {
    render(<Markdown body={FENCE} />)
    await screen.findByTestId('diagram')
    act(() => theme.set('light', '#eaf0f0'))
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2))
    act(() => theme.set('dark', '#16222a'))
    await act(async () => { await Promise.resolve() })
    expect(mermaid.render).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('diagram').id).toBe(mermaid.render.mock.calls[0][0])
  })

  it('redraws when the theme changes', async () => {
    render(<Markdown body={FENCE} />)
    await screen.findByTestId('diagram')
    expect(mermaid.render).toHaveBeenCalledTimes(1)
    act(() => theme.set('light', '#eaf0f0'))
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2))
    const cfg = mermaid.initialize.mock.calls.at(-1)![0]
    expect(cfg.darkMode).toBe(false)
    expect(cfg.themeVariables.background).toBe('#eaf0f0')
    expect(screen.getByTestId('diagram')).toBeInTheDocument()
  })
})
