import React from 'react'

interface AfarensisLogoProps {
  /** Pixel size (width = height) */
  size?: number
  /** CSS color value — defaults to currentColor so it inherits from parent */
  color?: string
  className?: string
}

/**
 * Synthetic Ascension — Afarensis product logo
 * DNA double helix with an upward-trending arrow, symbolising genomic data growth.
 */
const AfarensisLogo: React.FC<AfarensisLogoProps> = ({
  size = 36,
  color = 'currentColor',
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    stroke={color}
    strokeWidth="7.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Afarensis logo"
  >
    {/* ── Bottom-left Y fork ──────────────────────────────────── */}
    <line x1="20" y1="80" x2="6"  y2="94" />   {/* left  arm */}
    <line x1="20" y1="80" x2="22" y2="97" />   {/* lower arm */}

    {/* ── Strand A  (becomes the arrow) ──────────────────────── */}
    {/* first half: sweeps LEFT of the main diagonal */}
    <path d="M20,80 C5,62 16,44 38,40" />
    {/* second half: sweeps RIGHT of the main diagonal → arrow */}
    <path d="M38,40 C60,36 72,20 84,9" />
    {/* arrow shaft extension to tip */}
    <line x1="84" y1="9" x2="93" y2="2" />

    {/* ── Arrow head (open right-angle tip pointing upper-right) */}
    <line x1="93" y1="2"  x2="76" y2="2"  />   {/* bar going left  */}
    <line x1="93" y1="2"  x2="93" y2="17" />   {/* bar going down  */}

    {/* ── Strand B  (ends as short arm at top-right) ─────────── */}
    {/* first half: sweeps RIGHT of the main diagonal */}
    <path d="M28,88 C44,78 50,60 38,40" />
    {/* second half: sweeps LEFT of the main diagonal */}
    <path d="M38,40 C26,20 44,6 64,6" />
    {/* short horizontal arm at top */}
    <line x1="64" y1="6" x2="82" y2="6" />

    {/* ── Ladder rungs ────────────────────────────────────────── */}
    <line x1="10" y1="73" x2="26" y2="82" />   {/* rung 1 */}
    <line x1="16" y1="62" x2="34" y2="62" />   {/* rung 2 */}
    <line x1="28" y1="50" x2="46" y2="52" />   {/* rung 3 */}
    <line x1="46" y1="36" x2="54" y2="32" />   {/* rung 4 */}
    <line x1="58" y1="24" x2="68" y2="16" />   {/* rung 5 */}
    <line x1="72" y1="13" x2="80" y2="8"  />   {/* rung 6 */}
  </svg>
)

export default AfarensisLogo
