import type { EventPlan, Provenance } from '@/domain/types';
import { Card } from '@/components/ui/Card';
import { formatInr } from '@/lib/format';
import { buildBudgetView } from '@/engine/budgetView';

export interface ProvenanceBreakdownProps {
  plan: EventPlan;
  className?: string;
}

const PROVENANCE_LABELS: Record<Provenance, string> = {
  user: 'Your input',
  estimate: 'Estimate',
  verified: 'Verified quote',
};

const PROVENANCE_COLORS: Record<Provenance, string> = {
  user: 'bg-[#6B2D5C]', // Plum
  estimate: 'bg-[#D4A24C]', // Amber gold
  verified: 'bg-[#1F6F54]', // Forest green
};

const PROVENANCE_INDICATORS: Record<Provenance, string> = {
  user: 'text-[#6B2D5C]',
  estimate: 'text-[#8A5A00]',
  verified: 'text-[#1F6F54]',
};

/**
 * ProvenanceBreakdown visualizes spending distribution across host inputs, engine estimates, and verified quotes.
 * WHY: Provides plain-language transparency so hosts know which parts of their budget are placeholders.
 */
export function ProvenanceBreakdown({
  plan,
  className = '',
}: ProvenanceBreakdownProps) {
  const { provenance } = buildBudgetView(plan);

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div>
        <h3 className="font-serif font-bold text-base text-[#2B1B2E]">
          Quote Reliability
        </h3>
        <p className="text-xs text-[#5B4A5E] mt-0.5">
          Estimates are placeholders; replace them with real quotes as you receive them.
        </p>
      </div>

      {/* Decorative segmented bar */}
      <div
        className="h-3 w-full bg-[#F4EDE6] rounded-full overflow-hidden flex"
        aria-hidden="true"
      >
        {provenance.map((p) => {
          if (p.sharePercent <= 0) return null;
          return (
            <div
              key={p.provenance}
              className={`h-full ${PROVENANCE_COLORS[p.provenance]} transition-all duration-300`}
              style={{ width: `${p.sharePercent}%` }}
              title={`${PROVENANCE_LABELS[p.provenance]}: ${p.sharePercent}%`}
            />
          );
        })}
      </div>

      {/* Accessible legend list */}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {provenance.map((p) => (
          <li
            key={p.provenance}
            className="flex items-center gap-2 p-2 rounded-md bg-[#FAF5F0] border border-[#E6DCD2]"
          >
            <span
              className={`h-3 w-3 rounded-full shrink-0 ${PROVENANCE_COLORS[p.provenance]}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <span className="font-semibold text-xs text-[#2B1B2E] block truncate">
                {PROVENANCE_LABELS[p.provenance]}
              </span>
              <span className={`text-xs font-medium ${PROVENANCE_INDICATORS[p.provenance]}`}>
                {formatInr(p.total)} ({p.sharePercent}%)
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
