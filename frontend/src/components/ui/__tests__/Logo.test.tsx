import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '../Logo'

describe('Logo', () => {
  it("renders Tom's full home logo (dark-UI variant), not the house-only mark", () => {
    render(<Logo />)
    const img = screen.getByTestId('logo-mark')
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toContain('home-logo-square-dark')
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

  it('scales the logo to the requested size', () => {
    render(<Logo size={64} />)
    const svg = screen.getByTestId('logo-mark')
    expect(svg.getAttribute('width')).toBe('64')
    expect(svg.getAttribute('height')).toBe('64')
  })

  it('marks the logo aria-hidden — the adjacent wordmark carries the name', () => {
    render(<Logo />)
    expect(screen.getByTestId('logo-mark')).toHaveAttribute('aria-hidden', 'true')
  })

  it('forwards className to the wrapper', () => {
    const { container } = render(<Logo className="my-class" />)
    expect(container.firstElementChild).toHaveClass('my-class')
  })
})
