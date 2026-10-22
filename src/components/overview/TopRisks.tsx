import Link from 'next/link';
import type { EventPlan, RiskSeverity } from '@/domain/types';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { scoreRisks } from '@/engine/risk';
import { engineContext } from '@/store/engineContext';

export interface TopRisksProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

function getRiskSeverityTone(sev: RiskSeverity): BadgeTone {
  if (sev === 'high') return 'danger';
  if (sev === 'medium') return 'warning';
  return 'neutral';
}

/**
 * TopRisks highlights the most critical vulnerability vectors scored by the Chaos engine.
 * WHY: Answers "What could go wrong?" with transparent mitigations and link to Chaos Lab simulation.
 */
export function TopRisks({ plan, eventId, className = '' }: TopRisksProps) {
  const report = scoreRisks(plan, engineContext);
  const top = report.risks.slice(0, 3);

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E6DCD2]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">Vulnerability Analysis</h3>
          <p className="text-xs text-[#5B4A5E] mt-0.5">
            Operational stress test score: <span className="font-semibold">{report.score}/100</span> ({report.band} band)
          </p>
        </div>
        <Link href={`/events/${eventId}/chaos`}>
          <Button variant="secondary" size="sm" icon={<Icon name="sparkle" size={14} aria-hidden="true" />}>
            Simulate in Chaos Lab
          </Button>
        </Link>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-[#1F6F54] font-medium flex items-center gap-1.5 py-2">
          <Icon name="check" size={16} aria-hidden="true" />
          No severe operational vulnerabilities detected.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top.map((risk) => (
            <div
              key={risk.id}
              className="p-3.5 rounded-lg border border-[#E6DCD2] bg-[#FAF5F0] flex flex-col justify-between gap-2.5"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm text-[#2B1B2E]">{risk.title}</h4>
                  <Badge tone={getRiskSeverityTone(risk.severity)}>
                    {risk.severity}
                  </Badge>
                </div>
                <p className="text-xs text-[#5B4A5E] leading-relaxed">{risk.explanation}</p>
              </div>

              <div className="pt-2 border-t border-[#E6DCD2]">
                <p className="text-xs text-[#1F6F54] leading-relaxed">
                  <strong className="text-[#2B1B2E]">Mitigation:</strong> {risk.mitigation}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
