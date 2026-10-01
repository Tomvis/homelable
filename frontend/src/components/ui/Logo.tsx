import homeLogoDark from '@/assets/home-logo-square-dark.svg'

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Tom's full home logo (HW-48 home theme, Tomvis fork) — the dark-UI variant
 * (faint cloud) of homelab-stacks `theme/dist/logo/home-logo-square-dark.svg`,
 * since Homelable's chrome is dark-only. Wordmark in Rubik, "Home" in text,
 * "lable" in primary (never the cyan, which means "on right now").
 */
export function Logo({ size = 32, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={homeLogoDark}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        data-testid="logo-mark"
        draggable={false}
      />
      {showText && (
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: size * 0.55, fontFamily: "'Rubik', system-ui, sans-serif" }}
        >
          <span style={{ color: '#EAF0F0' }}>Home</span>
          <span style={{ color: '#8DB0BD' }}>lable</span>
        </span>
      )}
    </div>
  );
}
