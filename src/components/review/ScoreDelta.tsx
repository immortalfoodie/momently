import type { RiskBand } from '@/engine/risk';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';

export interface ScoreDeltaProps {
  scoreBefore: number;
  scoreAfter: number;
  className?: string;
}

function getBand(score: number): RiskBand {
  if (score >= 75) return 'fragile';
  if (score >= 50) return 'exposed';
  if (score >= 25) return 'manageable';
  return 'calm';
}

/**
 * Renders the delta between two Chaos risk scores with contextual severity bands.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Avoids color-only indicators by combining the exact numerical delta, textual band transitions,
 * and high-contrast SVG glyphs ("Chaos Score 58 -> 41 (exposed -> manageable)").
 */
export function ScoreDelta({ scoreBefore, scoreAfter, className = '' }: ScoreDeltaProps) {
  const bandBefore = getBand(scoreBefore);
  const bandAfter = getBand(scoreAfter);
  const improved = scoreAfter < scoreBefore;
  const worsened = scoreAfter > scoreBefore;

  const tone = improved ? 'success' : worsened ? 'warning' : 'neutral';
  const iconName = improved ? 'check' : worsened ? 'alert' : 'info';

  return (
    <div className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <Badge tone={tone} className="inline-flex items-center gap-1.5 font-medium">
        <Icon name={iconName} size={14} aria-hidden="true" />
        <span>
          Chaos Score {scoreBefore}{' '}
          <span aria-hidden="true">→</span>
          <span className="sr-only">to</span>{' '}
          {scoreAfter} ({bandBefore}{' '}
          <span aria-hidden="true">→</span>
          <span className="sr-only">to</span>{' '}
          {bandAfter})
        </span>
      </Badge>
    </div>
  );
}
