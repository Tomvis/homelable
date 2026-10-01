interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Home mark (HW-48 home theme, Tomvis fork) — kept in sync with homelab-stacks
 * `theme/dist/logo/home-mark.svg`: slate house + white window. Wordmark in Rubik,
 * "Home" in text, "lable" in primary (never the cyan, which means "on right now").
 */
export function Logo({ size = 32, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        data-testid="logo-mark"
      >
        <rect x="352" y="92" width="48" height="140" fill="#587E8D" />
        <polygon points="256,40 16,272 96,272 96,464 416,464 416,272 496,272" fill="#587E8D" />
        <polyline points="72,258 256,82 440,258" fill="none" stroke="#FFFFFF" strokeWidth="30" />
        <g fill="#FFFFFF">
          <rect x="196" y="250" width="54" height="54" />
          <rect x="262" y="250" width="54" height="54" />
          <rect x="196" y="316" width="54" height="54" />
          <rect x="262" y="316" width="54" height="54" />
        </g>
      </svg>
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
