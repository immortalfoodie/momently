'use client';

import { useState } from 'react';
import type { EventPlan, PlanPatchOp, VendorNeed, VendorNeedStatus, VendorQuote } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Select } from '@/components/ui/Select';
import { buildVendorBrief } from '@/lib/vendorBrief';
import { BriefFallbackDialog } from './BriefFallbackDialog';
import { QuoteComparison } from './QuoteComparison';
import { QuoteDialog } from './QuoteDialog';

export interface VendorNeedCardProps {
  plan: EventPlan;
  need: VendorNeed;
  eventId: string;
  className?: string;
}

const STATUS_OPTIONS: { value: VendorNeedStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'comparing', label: 'Comparing quotes' },
  { value: 'booked', label: 'Booked' },
];

export function VendorNeedCard({ plan, need, eventId, className = '' }: VendorNeedCardProps) {
  const { announce } = useAnnouncer();
  const { applyEdit } = useUserEdit(eventId);

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<VendorQuote | null>(null);
  const [fallbackDialogOpen, setFallbackDialogOpen] = useState(false);
  const [briefText, setBriefText] = useState('');

  const categoryTitle = need.category.charAt(0).toUpperCase() + need.category.slice(1);

  const handleStatusChange = async (newStatus: VendorNeedStatus) => {
    const op: PlanPatchOp = {
      type: 'update_vendor_need',
      category: need.category,
      status: newStatus,
    };
    const ok = await applyEdit([op], `Changed ${categoryTitle} status to ${newStatus}`);
    if (ok) {
      announce(`${categoryTitle} status updated to ${newStatus.replace('_', ' ')}.`);
    }
  };

  const handleCopyBrief = async () => {
    const brief = buildVendorBrief(plan, need);
    setBriefText(brief);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(brief);
        announce(`Inquiry brief for ${categoryTitle} copied to clipboard.`);
      } else {
        setFallbackDialogOpen(true);
      }
    } catch {
      setFallbackDialogOpen(true);
    }
  };

  const handleSaveQuote = async (quote: VendorQuote): Promise<boolean> => {
    const op: PlanPatchOp = {
      type: 'upsert_vendor_quote',
      category: need.category,
      quote,
    };
    const ok = await applyEdit([op], `Saved quote from ${quote.vendorName}`);
    if (ok) {
      announce(`Quote from ${quote.vendorName} saved.`);
    }
    return ok;
  };

  const handleRemoveQuote = async (vendorName: string): Promise<boolean> => {
    const op: PlanPatchOp = {
      type: 'remove_vendor_quote',
      category: need.category,
      vendorName,
    };
    const ok = await applyEdit([op], `Removed quote from ${vendorName}`);
    if (ok) {
      announce(`Quote from ${vendorName} deleted.`);
    }
    return ok;
  };

  return (
    <section aria-labelledby={`vendor-need-${need.id}-heading`} className={`space-y-4 ${className}`}>
      <Card className="p-4 sm:p-6 bg-white border border-[#E6DCD2] space-y-6">
        {/* Header & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6DCD2]">
          <h2 id={`vendor-need-${need.id}-heading`} className="text-xl font-serif font-bold text-[#2B1B2E]">
            {categoryTitle}
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#7A6B7E]">Status:</span>
            <Select
              value={need.status}
              onChange={(e) => handleStatusChange(e.target.value as VendorNeedStatus)}
              aria-label={`Status for ${categoryTitle}`}
              className="text-xs py-1.5 min-h-[44px]"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Requirements and Screening Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7A6B7E]">
              What to compare
            </h3>
            <ul className="space-y-1.5">
              {need.requirements.map((req) => (
                <li key={req} className="text-sm text-[#2B1B2E] flex items-start gap-2">
                  <Icon name="check" size={16} className="text-[#1F6F54] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7A6B7E]">
              Ask before you pay
            </h3>
            <ol className="space-y-1.5 list-decimal list-inside text-sm text-[#5B4A5E]">
              {need.questionsToAsk.map((q) => (
                <li key={q} className="leading-relaxed">
                  <span className="text-[#2B1B2E]">{q}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopyBrief}
            className="min-h-[44px]"
          >
            <Icon name="checklist" size={16} className="mr-2" aria-hidden="true" />
            Copy vendor brief
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setEditingQuote(null);
              setQuoteDialogOpen(true);
            }}
            className="min-h-[44px]"
          >
            <Icon name="plus" size={16} className="mr-2" aria-hidden="true" />
            Add a quote
          </Button>
        </div>

        {/* Quotes Comparison Table */}
        <QuoteComparison
          plan={plan}
          need={need}
          eventId={eventId}
          onEditQuote={(quote) => {
            setEditingQuote(quote);
            setQuoteDialogOpen(true);
          }}
        />
      </Card>

      {/* Quote Dialog */}
      {quoteDialogOpen && (
        <QuoteDialog
          open={quoteDialogOpen}
          onClose={() => {
            setQuoteDialogOpen(false);
            setEditingQuote(null);
          }}
          need={need}
          initialQuote={editingQuote}
          onSave={handleSaveQuote}
          onRemove={handleRemoveQuote}
        />
      )}

      {/* Brief Fallback Dialog */}
      {fallbackDialogOpen && (
        <BriefFallbackDialog
          open={fallbackDialogOpen}
          onClose={() => setFallbackDialogOpen(false)}
          brief={briefText}
        />
      )}
    </section>
  );
}
