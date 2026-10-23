'use client';

import type { EventPlan, VendorNeed, VendorQuote } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { compareQuotes } from '@/engine/quoteComparison';
import { formatInr } from '@/lib/format';
import { UseQuoteButton } from './UseQuoteButton';

export interface QuoteComparisonProps {
  plan: EventPlan;
  need: VendorNeed;
  eventId: string;
  onEditQuote: (quote: VendorQuote) => void;
  className?: string;
}

export function QuoteComparison({
  plan,
  need,
  eventId,
  onEditQuote,
  className = '',
}: QuoteComparisonProps) {
  if (need.quotes.length === 0) {
    return null;
  }

  const comparison = compareQuotes(plan, need);
  const { questions, columns, observations } = comparison;

  return (
    <Card className={`p-4 sm:p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">Quotes side by side</h3>

      {/* Focusable horizontally scrollable wrapper for WCAG compliance */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Quote comparison table"
        className="overflow-x-auto rounded-[12px] border border-[#E6DCD2] focus:outline-none focus:ring-2 focus:ring-[#2B1B2E]"
      >
        <table className="w-full text-left text-sm border-collapse min-w-[500px]">
          <caption className="sr-only">Your quotes side by side</caption>
          <thead>
            <tr className="bg-[#F5F2EB] border-b border-[#E6DCD2]">
              <th scope="col" className="py-3 px-4 font-semibold text-[#2B1B2E] w-48">
                Criteria
              </th>
              {columns.map((col) => (
                <th key={col.vendorName} scope="col" className="py-3 px-4 font-semibold text-[#2B1B2E]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{col.vendorName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const original = need.quotes.find((q) => q.vendorName === col.vendorName);
                        if (original) onEditQuote(original);
                      }}
                      aria-label={`Edit quote for ${col.vendorName}`}
                      className="text-xs text-[#5B4A5E] hover:text-[#2B1B2E] min-h-[32px] px-2 py-1"
                    >
                      Edit
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6DCD2]">
            {/* Price row */}
            <tr>
              <th scope="row" className="py-3 px-4 font-medium text-[#2B1B2E] bg-[#FAF7F2]">
                Price
              </th>
              {columns.map((col) => (
                <td key={col.vendorName} className="py-3 px-4 font-bold text-[#2B1B2E]">
                  {formatInr(col.price)}
                </td>
              ))}
            </tr>

            {/* Completeness row */}
            <tr>
              <th scope="row" className="py-3 px-4 font-medium text-[#2B1B2E] bg-[#FAF7F2]">
                Completeness
              </th>
              {columns.map((col) => (
                <td key={col.vendorName} className="py-3 px-4 text-[#5B4A5E]">
                  {col.completenessPercent}% ({col.answered}/{col.total} answered)
                </td>
              ))}
            </tr>

            {/* Questions rows */}
            {questions.map((q) => (
              <tr key={q}>
                <th scope="row" className="py-3 px-4 text-xs font-medium text-[#5B4A5E] bg-[#FAF7F2] align-top">
                  {q}
                </th>
                {need.quotes.map((quote) => {
                  const ans = quote.answers[q]?.trim();
                  return (
                    <td key={quote.vendorName} className="py-3 px-4 text-xs text-[#2B1B2E] align-top">
                      {ans ? (
                        <span>{ans}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#7A6B7E] italic">
                          <Icon name="info" size={14} aria-hidden="true" />
                          Not answered yet
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Action row */}
            <tr>
              <th scope="row" className="py-3 px-4 bg-[#FAF7F2]">
                <span className="sr-only">Budget action</span>
              </th>
              {need.quotes.map((quote) => (
                <td key={quote.vendorName} className="py-3 px-4">
                  <UseQuoteButton
                    plan={plan}
                    need={need}
                    quote={quote}
                    eventId={eventId}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* vsBudget breakdown */}
      <div className="space-y-1 pt-1">
        {columns.map((col) => {
          if (!col.vsBudget) return null;
          const diffText =
            col.vsBudget.difference >= 0
              ? `+${formatInr(col.vsBudget.difference)}`
              : `-${formatInr(Math.abs(col.vsBudget.difference))}`;
          return (
            <p key={col.vendorName} className="text-xs text-[#5B4A5E]">
              <strong>{col.vendorName}</strong>: {diffText} ({col.vsBudget.percent > 0 ? `+${col.vsBudget.percent}` : col.vsBudget.percent}% vs your current budget allocation)
            </p>
          );
        })}
      </div>

      {/* Factual observations */}
      {observations.length > 0 && (
        <div className="p-3.5 rounded-[12px] bg-[#FAF7F2] border border-[#E6DCD2] space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#7A6B7E]">
            Observations
          </h4>
          <ul className="space-y-1">
            {observations.map((obs) => (
              <li key={obs} className="text-xs text-[#2B1B2E] flex items-start gap-1.5">
                <span className="text-[#6B2D5C]">•</span>
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fixed disclaimer */}
      <p className="text-xs text-[#7A6B7E] italic pt-1 border-t border-[#E6DCD2]">
        Based only on what you entered. Momently has no vendor ratings, reviews or availability data, and doesn&apos;t invent any.
      </p>
    </Card>
  );
}
