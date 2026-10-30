'use client';

import { useMemo, useState } from 'react';
import type { Concept, EventPlan } from '@/domain/types';
import { priceConcept } from '@/engine/assistant/concepts';
import { getBudgetCap } from '@/engine/budget';
import { formatInr } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { engineContext } from '@/store/engineContext';

export interface CompareTableProps {
  concepts: Concept[];
  plan: EventPlan;
  className?: string;
}

function formatTier(level?: string): string {
  if (level === 'premium') return 'Premium';
  if (level === 'standard') return 'Standard';
  if (level === 'essential') return 'Essential';
  return '—';
}

/**
 * CompareTable renders a full semantic side-by-side comparison matrix across concepts.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Uses a focusable scroll container (`tabIndex={0}` + `role="region"`) so keyboard users can navigate
 * wide tables horizontally without losing cursor placement. Features explicit row/column table headers
 * and a visible, descriptive caption.
 */
export function CompareTable({ concepts, plan, className = '' }: CompareTableProps) {
  const [open, setOpen] = useState(false);

  const pricedTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const c of concepts) {
      totals[c.id] = priceConcept(plan, c, engineContext);
    }
    return totals;
    // Plans are immutable, so the plan reference changes exactly when pricing inputs change.
  }, [plan, concepts]);

  const cap = getBudgetCap(plan.constraints);

  if (concepts.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="concept-compare-matrix"
        >
          {open ? 'Hide side-by-side comparison' : 'Compare side by side'}
        </Button>
      </div>

      {open && (
        <div
          id="concept-compare-matrix"
          tabIndex={0}
          role="region"
          aria-label="Side-by-side concept comparison"
          className="overflow-x-auto rounded-xl border border-border bg-white shadow-xs focus:ring-2 focus:ring-primary outline-hidden"
        >
          <table className="w-full text-left text-xs border-collapse">
            <caption className="px-4 py-2.5 text-left text-xs font-semibold text-ink-muted bg-surface-warm border-b border-border">
              Side-by-side concept comparison matrix
            </caption>
            <thead>
              <tr className="border-b border-border bg-surface-muted text-ink">
                <th scope="col" className="px-4 py-3 font-semibold w-40 min-w-36">
                  Dimension
                </th>
                {concepts.map((c) => (
                  <th key={c.id} scope="col" className="px-4 py-3 font-semibold min-w-48 text-ink">
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Estimated total
                </th>
                {concepts.map((c) => (
                  <td key={c.id} className="px-4 py-2.5 font-bold text-ink">
                    <Money amount={pricedTotals[c.id] ?? 0} />
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Vs your cap
                </th>
                {concepts.map((c) => {
                  const total = pricedTotals[c.id] ?? 0;
                  if (cap === null) {
                    return (
                      <td key={c.id} className="px-4 py-2.5 text-ink-muted">
                        No cap set
                      </td>
                    );
                  }
                  const isOver = total > cap;
                  return (
                    <td
                      key={c.id}
                      className={`px-4 py-2.5 font-medium ${isOver ? 'text-danger' : 'text-success'}`}
                    >
                      {isOver ? `Over by ${formatInr(total - cap)}` : `${formatInr(cap - total)} to spare`}
                    </td>
                  );
                })}
              </tr>

              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Decor & theme
                </th>
                {concepts.map((c) => (
                  <td key={c.id} className="px-4 py-2.5 text-ink-muted">
                    {formatTier(c.qualityProfile?.decor ?? c.qualityProfile?.decor_theme)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Entertainment
                </th>
                {concepts.map((c) => (
                  <td key={c.id} className="px-4 py-2.5 text-ink-muted">
                    {formatTier(c.qualityProfile?.entertainment)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Photography
                </th>
                {concepts.map((c) => (
                  <td key={c.id} className="px-4 py-2.5 text-ink-muted">
                    {formatTier(c.qualityProfile?.photography)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Catering
                </th>
                {concepts.map((c) => (
                  <td key={c.id} className="px-4 py-2.5 text-ink-muted">
                    {formatTier(c.qualityProfile?.catering)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Signature moment
                </th>
                {concepts.map((c) => (
                  <td key={c.id} className="px-4 py-2.5 text-ink-muted">
                    {c.experienceHighlights[0] ?? '—'}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-surface-warm">
                <th scope="row" className="px-4 py-2.5 font-semibold text-ink">
                  Main trade-off
                </th>
                {concepts.map((c) => (
                  <td key={c.id} className="px-4 py-2.5 text-ink-muted">
                    {c.tradeoffs}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
