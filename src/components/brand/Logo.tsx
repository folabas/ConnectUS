/**
 * The ConnectUs mark.
 *
 * Concept: two screens, one frame. A rounded screen with the play triangle
 * knocked out of it, and a second screen offset behind — the same film, on more
 * than one device. The knockout means the triangle is negative space rather than
 * a stacked shape, which is what keeps it crisp when the browser renders it into
 * a 16px favicon.
 *
 * An earlier version stacked three translucent triangles with a progress bar
 * beneath. It looked fine at 96px and turned to mush below 32px, which is the
 * size that actually matters for a tab.
 *
 * Pure SVG: no canvas, no WebGL, no animation loop, nothing to schedule.
 */

import { cn } from '@/lib/ui';

interface LogoProps {
  className?: string;
  /** Height of the mark in px. The wordmark scales from it. */
  size?: number;
  /** Render the "ConnectUs" wordmark beside the mark. */
  withWordmark?: boolean;
  /** Ignore the brand gradient and draw in the inherited text colour. */
  monochrome?: boolean;
}

/**
 * A single, stable gradient id.
 *
 * The first version generated one per instance from a module counter, which
 * desynchronised between the server and client renders and produced a hydration
 * mismatch. Since every mark uses the identical gradient, sharing one id is not
 * a collision to work around — duplicate identical <defs> resolve to the same
 * paint, and the value is deterministic on both sides of hydration.
 */
const GRADIENT_ID = 'cu-logo-gradient';

export function LogoMark({
  className,
  size = 32,
  monochrome = false,
}: Omit<LogoProps, 'withWordmark'>) {
  const fill = monochrome ? 'currentColor' : `url(#${GRADIENT_ID})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      {!monochrome && (
        <defs>
          <linearGradient id={GRADIENT_ID} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F5C77A" />
            <stop offset="1" stopColor="#D08A1E" />
          </linearGradient>
        </defs>
      )}

      {/* The second screen. Offset down-left so the silhouette stays asymmetric
          and readable rather than becoming a plain rounded square. */}
      <rect x="3" y="11" width="34" height="26" rx="7" fill={fill} opacity="0.32" />

      {/* The near screen, with the play triangle cut out of it. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17 6h21a7 7 0 0 1 7 7v22a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7V13a7 7 0 0 1 7-7Zm6.6 11.4a1.6 1.6 0 0 0-2.4 1.4v10.4a1.6 1.6 0 0 0 2.4 1.4l9-5.2a1.6 1.6 0 0 0 0-2.8l-9-5.2Z"
        fill={fill}
      />
    </svg>
  );
}

export function Logo({
  className,
  size = 32,
  withWordmark = true,
  monochrome = false,
}: LogoProps) {
  if (!withWordmark) {
    return <LogoMark className={className} size={size} monochrome={monochrome} />;
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} monochrome={monochrome} />
      <span
        className="font-medium tracking-tight"
        style={{ fontSize: size * 0.6, letterSpacing: '-0.025em' }}
      >
        Connect<span className={monochrome ? undefined : 'text-[var(--brand-soft)]'}>Us</span>
      </span>
    </span>
  );
}
