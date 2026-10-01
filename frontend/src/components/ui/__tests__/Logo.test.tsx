import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '../Logo'

describe('Logo', () => {
  it('renders the home mark (house + window), not a placeholder icon', () => {
    render(<Logo />)
    const svg = screen.getByTestId('logo-mark')
    // Canonical house outline from homelab-stacks theme/dist/logo/home-mark.svg
    expect(svg.querySelector('polygon')?.getAttribute('points'))
      .toBe('256,40 16,272 96,272 96,464 416,464 416,272 496,272')
    // Chimney + 4 window panes
    expect(svg.querySelectorAll('rect').length).toBe(5)
  })

  it('uses the home wordmark colors (Home #EAF0F0 / lable #8DB0BD)', () => {
    render(<Logo showText />)
    expect(screen.getByText('Home')).toHaveStyle({ color: '#EAF0F0' })
    expect(screen.getByText('lable')).toHaveStyle({ color: '#8DB0BD' })
  })

  it('hides the wordmark when showText is false', () => {
    render(<Logo showText={false} />)
    expect(screen.queryByText('Home')).toBeNull()
    expect(screen.getByTestId('logo-mark')).toBeInTheDocument()
  })

  it('scales the svg to the requested size', () => {
    render(<Logo size={64} />)
    const svg = screen.getByTestId('logo-mark')
    expect(svg.getAttribute('width')).toBe('64')
    expect(svg.getAttribute('height')).toBe('64')
  })

  it('two logos can coexist (no shared defs ids)', () => {
    render(<><Logo /><Logo /></>)
    const marks = screen.getAllByTestId('logo-mark')
    expect(marks).toHaveLength(2)
    for (const svg of marks) expect(svg.querySelector('[id]')).toBeNull()
  })

  it('marks the svg aria-hidden — the adjacent wordmark carries the name', () => {
    render(<Logo />)
    expect(screen.getByTestId('logo-mark')).toHaveAttribute('aria-hidden', 'true')
  })

  it('forwards className to the wrapper', () => {
    const { container } = render(<Logo className="my-class" />)
    expect(container.firstElementChild).toHaveClass('my-class')
  })
})
