'use client';

import type { EventPlan } from '@/domain/types';
import type { RiskBand } from '@/engine/risk';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { EventDerivedMetrics } from '@/store/selectors';

export interface ChaosScoreCardProps {
  plan: EventPlan;
  derived?: EventDerivedMetrics;
  className?: string;
}

function getBandDetails(band: RiskBand): {
  tone: BadgeTone;
  icon: 'check' | 'alert' | 'info';
  color: string;
  positiveMessage?: string;
} {
  switch (band) {
    case 'calm':
      return {
        tone: 'success',
        icon: 'check',
        color: '#1F6F54',
        positiveMessage: 'Nicely balanced! Low exposure to disruption.',
      };
    case 'manageable':
      return { tone: 'brand', icon: 'info', color: '#6B2D5C' };
    case 'exposed':
      return { tone: 'warning', icon: 'alert', color: '#B45309' };
    case 'fragile':
      return { tone: 'danger', icon: 'alert', color: '#A12B3A' };
  }
}

function getBreakdownRows(report: EventDerivedMetrics['scoreRisks'] | undefined) {
  if (!report) return [];
  return report.breakdown.map((b) => {
    const matchedRisk = report.risks.find(
      (r) => r.id === `risk_${b.ruleId}` || r.id.includes(b.ruleId),
    );
    return {
      ruleId: b.ruleId,
      title: matchedRisk?.title ?? b.ruleId.replace(/_/g, ' '),
      points: b.points,
      severity: matchedRisk?.severity ?? 'standard',
    };
  });
}

/**
 * Renders the transparent 0-100 Chaos Score gauge, severity band badge, explanatory disclaimer,
 * and rule-by-rule calculation breakdown table.
 *
 * ACCESSIBILITY & PRINCIPLE DECISION (WHY):
 * The score is transparently presented as an objective sum of engine heuristic rules, not an opaque
 * predictive AI hallucination. High-contrast typography and semantic tables guarantee assistive clarity.
 */
export function ChaosScoreCard({ derived, className = '' }: ChaosScoreCardProps) {
  const report = derived?.scoreRisks;
  const score = report?.score ?? 0;
  const band: RiskBand = report?.band ?? 'calm';
  const details = getBandDetails(band);

  // Semicircle gauge calculation (radius 48, circum = PI * 48 = 150.8)
  const radius = 48;
  const circumference = Math.PI * radius;
  const progressRatio = Math.min(100, Math.max(0, score)) / 100;
  const strokeDashoffset = circumference * (1 - progressRatio);
  const breakdownRows = getBreakdownRows(report);

  return (
    <Card className={`p-6 border-[#E6DCD2] bg-white space-y-5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-[#5C4556]">
            Resilience Index
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-serif font-bold text-[#2B1B2E] tracking-tight">
              {score} / 100
            </span>
            <Badge tone={details.tone} className="inline-flex items-center gap-1.5 capitalize text-xs">
              <Icon name={details.icon} size={13} aria-hidden="true" />
              <span>{band}</span>
            </Badge>
          </div>
          {details.positiveMessage && (
            <p className="text-xs font-medium text-[#1F6F54] pt-0.5">
              {details.positiveMessage}
            </p>
          )}
        </div>

        {/* Decorative Semicircle Gauge */}
        <div className="relative w-36 h-20 shrink-0 self-center sm:self-auto" aria-hidden="true">
          <svg viewBox="0 0 120 70" className="w-full h-full overflow-visible">
            {/* Background track */}
            <path
              d="M 12 60 A 48 48 0 0 1 108 60"
              fill="none"
              stroke="#F4EDE6"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Value stroke */}
            <path
              d="M 12 60 A 48 48 0 0 1 108 60"
              fill="none"
              stroke={details.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
        </div>
      </div>

      <p className="text-xs text-[#5C4556] leading-relaxed border-t border-[#F4EDE6] pt-3">
        Higher means more exposed. This score adds up transparent rules; it isn&apos;t a prediction.
      </p>

      <details className="group border border-[#E6DCD2] rounded-lg bg-[#FAF5F0] p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-[#6B2D5C] hover:text-[#55224A] select-none list-none flex items-center justify-between">
          <span>How this score is calculated</span>
          <span className="text-[#5C4556] group-open:rotate-180 transition-transform" aria-hidden="true">
            ▾
          </span>
        </summary>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">How this score is calculated</caption>
            <thead>
              <tr className="border-b border-[#E6DCD2] text-[#5C4556]">
                <th scope="col" className="pb-1.5 font-semibold">Rule / Risk</th>
                <th scope="col" className="pb-1.5 font-semibold text-right">Points</th>
                <th scope="col" className="pb-1.5 font-semibold text-right">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCD2]/60">
              {breakdownRows.length > 0 ? (
                breakdownRows.map((row) => (
                  <tr key={row.ruleId}>
                    <td className="py-1.5 pr-2 text-[#2B1B2E] font-medium">{row.title}</td>
                    <td className="py-1.5 px-2 text-right text-[#6B2D5C] tabular-nums font-semibold">
                      +{row.points}
                    </td>
                    <td className="py-1.5 pl-2 text-right capitalize text-[#5C4556]">
                      {row.severity}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-2 text-center text-[#5C4556]">
                    No penalty points incurred. Plan baseline is optimal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
