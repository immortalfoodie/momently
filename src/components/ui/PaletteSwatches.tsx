export interface PaletteSwatchesProps {
  palette: string[];
  className?: string;
  showLabels?: boolean;
}

/**
 * Palette swatches primitive displaying concept aesthetic colors.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Color swatches must not be purely visual. Each color square is paired with accessible
 * text containing the explicit hexadecimal color value for assistive screen reader users.
 */
export function PaletteSwatches({
  palette,
  className = '',
  showLabels = false,
}: PaletteSwatchesProps) {
  return (
    <div
      role="group"
      aria-label="Color palette swatches"
      className={`flex items-center gap-2 ${className}`}
    >
      {palette.map((hex, index) => (
        <div key={`${hex}-${index}`} className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full border border-[#2B1B2E]/15 shadow-2xs shrink-0"
            style={{ backgroundColor: hex }}
            aria-hidden="true"
          />
          <span className={showLabels ? 'text-xs font-mono text-[#5B4A5E]' : 'sr-only'}>
            {hex}
          </span>
        </div>
      ))}
    </div>
  );
}
