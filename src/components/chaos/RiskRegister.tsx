'use client';

import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { Risk } from '@/domain/types';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getScenarioForRisk } from './riskScenarioMap';

export interface RiskRegisterProps {
  risks: Risk[];
  breakdown?: Array<{ ruleId: string; points: number }>;
  onSelectScenario?: (type: ChaosScenarioInput['type']) => void;
  className?: string;
}

function getSeverityTone(severity: Risk['severity']): BadgeTone {
  if (severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'neutral';
}

/**
 * RiskRegister listing active vulnerabilities with severity, points, mitigation,
 * and direct simulation launch shortcuts.
 */
export function RiskRegister({
  risks,
  breakdown = [],
  onSelectScenario,
  className = '',
}: RiskRegisterProps) {
  if (risks.length === 0) {
    return (
      <Card className={`p-6 border-[#E6DCD2] bg-[#FAF5F0] text-center space-y-1 ${className}`}>
        <p className="text-sm font-semibold text-[#1F6F54]">
          No major risks found: nicely done
        </p>
        <p className="text-xs text-[#5C4556]">
          Your celebration plan currently has solid buffer, confirmed pricing, and manageable assumptions.
        </p>
      </Card>
    );
  }

  return (
    <ul className={`space-y-3 ${className}`}>
      {risks.map((risk) => {
        const mappedScenario = getScenarioForRisk(risk.id);
        const ruleMatch = breakdown.find(
          (b) => b.ruleId === risk.id || `risk_${b.ruleId}` === risk.id,
        );
        const points = ruleMatch?.points;

        return (
          <li key={risk.id}>
            <Card className="p-4 border-[#E6DCD2] bg-white space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={getSeverityTone(risk.severity)} className="capitalize text-xs">
                      {risk.severity}
                    </Badge>
                    <h3 className="text-sm font-semibold text-[#2B1B2E]">{risk.title}</h3>
                    {points !== undefined && (
                      <span className="text-xs font-semibold text-[#6B2D5C] tabular-nums">
                        +{points} pts
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5C4556] leading-relaxed">{risk.explanation}</p>
                </div>

                {mappedScenario && onSelectScenario && (
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => onSelectScenario(mappedScenario)}
                    className="shrink-0"
                  >
                    Test this
                  </Button>
                )}
              </div>

              {risk.mitigation && (
                <div className="text-xs bg-[#FAF5F0] rounded-lg p-2.5 border border-[#F4EDE6] space-y-0.5">
                  <span className="font-semibold text-[#2B1B2E]">Mitigation: </span>
                  <span className="text-[#5C4556]">{risk.mitigation}</span>
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
