'use client';

import { useState } from 'react';
import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import { runStressTest, type StressReport } from '@/engine/chaos';
import { formatInr } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { engineContext } from '@/store/engineContext';

export interface StressTestPanelProps {
  plan: EventPlan;
  onOpenScenario: (type: ChaosScenarioInput['type']) => void;
  className?: string;
}

/**
 * StressTestPanel allows hosts to run all disruption scenarios at once and review vulnerabilities side-by-side.
 */
export function StressTestPanel({ plan, onOpenScenario, className = '' }: StressTestPanelProps) {
  const [report, setReport] = useState<StressReport | null>(null);
  const [reportVersion, setReportVersion] = useState<number | null>(null);

  const isStale = report !== null && reportVersion !== plan.version;

  const handleRunTest = () => {
    const res = runStressTest(plan, engineContext);
    setReport(res);
    setReportVersion(plan.version);
  };

  return (
    <Card className={`p-6 border-[#E6DCD2] bg-white space-y-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#2B1B2E]">Full stress test</h3>
            {isStale && <Badge tone="neutral">Out of date</Badge>}
          </div>
          <p className="text-xs text-[#5C4556]">
            Run all six disruption models against your current plan version to locate the weakest resilience link.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRunTest}
          className="shrink-0"
        >
          {report ? 'Run stress test again' : 'Run the full stress test'}
        </Button>
      </div>

      <p className="text-xs text-[#5C4556] bg-[#FAF5F0] p-3 rounded-lg border border-[#F4EDE6] leading-relaxed">
        Simulations never change your plan. Only a recovery you approve does. Momently never contacts vendors: you contact them yourself.
      </p>

      {report && (
        <div className={`space-y-4 ${isStale ? 'opacity-65' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="font-semibold text-xs text-[#2B1B2E] mb-2 text-left">
                Stress test: every scenario against your current plan
              </caption>
              <thead>
                <tr className="border-b border-[#E6DCD2] text-[#5C4556]">
                  <th scope="col" className="py-2 pr-3 font-semibold">Problem</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Result</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Best recovery</th>
                  <th scope="col" className="py-2 px-3 font-semibold text-right">Cost change</th>
                  <th scope="col" className="py-2 px-3 font-semibold text-right">Chaos Score after</th>
                  <th scope="col" className="py-2 px-3 font-semibold text-center">Within your cap</th>
                  <th scope="col" className="py-2 pl-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DCD2]/60 text-[#2B1B2E]">
                {report.rows.map((row) => {
                  const isWeakest = report.weakestType === row.type;
                  const formatCost = () => {
                    if (row.costDelta === undefined) return '—';
                    if (row.costDelta > 0) return `+${formatInr(row.costDelta)}`;
                    if (row.costDelta < 0) return `-${formatInr(Math.abs(row.costDelta))}`;
                    return '₹0';
                  };

                  return (
                    <tr key={row.type} className={isWeakest ? 'bg-[#FFF8F8]' : ''}>
                      <td className="py-2.5 pr-3 font-medium">
                        <div className="flex flex-col gap-1 items-start">
                          <span>{row.label}</span>
                          {isWeakest && (
                            <Badge tone="danger" className="inline-flex items-center gap-1 text-[11px]">
                              <Icon name="alert" size={11} aria-hidden="true" />
                              <span>Weakest spot</span>
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs text-[#5C4556]">
                        {row.applicable ? row.headline : `Unavailable: ${row.headline}`}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">{row.bestOptionLabel ?? '—'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                        {formatCost()}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#6B2D5C]">
                        {row.scoreAfter !== undefined ? `${row.scoreAfter} / 100` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.meetsCap === true && <Badge tone="success">Within cap</Badge>}
                        {row.meetsCap === false && <Badge tone="danger">Exceeds cap</Badge>}
                        {row.meetsCap === undefined && <span className="text-[#5C4556]">—</span>}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {row.applicable && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onOpenScenario(row.type)}
                          >
                            Open
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
