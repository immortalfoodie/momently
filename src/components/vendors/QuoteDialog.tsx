'use client';

import { useState } from 'react';
import type { VendorNeed, VendorQuote } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { TextInput } from '@/components/ui/TextInput';

interface QuoteFormProps {
  need: VendorNeed;
  initialQuote?: VendorQuote | null;
  onSave: (quote: VendorQuote) => void;
  onCancel: () => void;
  onRequestDelete?: () => void;
  isSubmitting: boolean;
}

function validateVendorName(rawName: string): { name: string; error?: string } {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { name: trimmed, error: 'Vendor name is required.' };
  }
  if (trimmed.length > 80) {
    return { name: trimmed, error: 'Vendor name must be 80 characters or fewer.' };
  }
  return { name: trimmed };
}

function QuoteFormActions({
  isSubmitting,
  isEdit,
  onCancel,
  onRequestDelete,
}: {
  isSubmitting: boolean;
  isEdit: boolean;
  onCancel: () => void;
  onRequestDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-[#E6DCD2]">
      {isEdit && onRequestDelete ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onRequestDelete}
          className="text-[#A82B35] min-h-[44px]"
        >
          Delete quote
        </Button>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="min-h-[44px]">
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting} className="min-h-[44px]">
          {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Save quote'}
        </Button>
      </div>
    </div>
  );
}

function QuoteForm({
  need,
  initialQuote,
  onSave,
  onCancel,
  onRequestDelete,
  isSubmitting,
}: QuoteFormProps) {
  const [vendorName, setVendorName] = useState(initialQuote?.vendorName ?? '');
  const [price, setPrice] = useState(initialQuote?.price ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialQuote?.answers ?? {});
  const [nameError, setNameError] = useState<string | null>(null);

  const handleAnswerChange = (question: string, val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [question]: val.slice(0, 200),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateVendorName(vendorName);
    if (result.error) {
      setNameError(result.error);
      return;
    }

    onSave({
      vendorName: result.name,
      price: Math.max(0, Math.round(price)),
      answers,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Vendor or business name" error={nameError ?? undefined}>
        <TextInput
          value={vendorName}
          onChange={(e) => {
            setVendorName(e.target.value);
            if (nameError) setNameError(null);
          }}
          placeholder="e.g. Heritage Banquets & Catering"
          maxLength={80}
          aria-label="Vendor or business name"
        />
      </Field>

      <Field label="Total quote price (₹ INR)" hint="All-inclusive quoted cost covering services, taxes, and buffers.">
        <NumberInput
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          min={0}
          step={1000}
          aria-label="Total quote price"
        />
      </Field>

      {need.questionsToAsk.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-[#E6DCD2]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7A6B7E]">
            Their answers to your questions (optional)
          </h3>
          {need.questionsToAsk.map((q) => (
            <Field key={q} label={q} hint="Their answer, leave blank if not asked yet">
              <TextInput
                value={answers[q] ?? ''}
                onChange={(e) => handleAnswerChange(q, e.target.value)}
                placeholder="e.g. Yes, includes 2 managers and 10 servers"
                maxLength={200}
                aria-label={`Answer for ${q}`}
              />
            </Field>
          ))}
        </div>
      )}

      <QuoteFormActions
        isSubmitting={isSubmitting}
        isEdit={Boolean(initialQuote)}
        onCancel={onCancel}
        onRequestDelete={onRequestDelete}
      />
    </form>
  );
}

export interface QuoteDialogProps {
  open: boolean;
  onClose: () => void;
  need: VendorNeed;
  initialQuote?: VendorQuote | null;
  onSave: (quote: VendorQuote) => Promise<boolean>;
  onRemove?: (vendorName: string) => Promise<boolean>;
}

export function QuoteDialog({
  open,
  onClose,
  need,
  initialQuote,
  onSave,
  onRemove,
}: QuoteDialogProps) {
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (quote: VendorQuote) => {
    setIsSubmitting(true);
    const success = await onSave(quote);
    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  const handleRemove = async () => {
    if (!initialQuote || !onRemove) return;
    setIsSubmitting(true);
    const success = await onRemove(initialQuote.vendorName);
    setIsSubmitting(false);
    if (success) {
      setConfirmRemoveOpen(false);
      onClose();
    }
  };

  const title = initialQuote
    ? `Edit quote: ${initialQuote.vendorName}`
    : `Add quote for ${need.category}`;

  return (
    <>
      <Dialog open={open && !confirmRemoveOpen} onClose={onClose} title={title}>
        <QuoteForm
          key={initialQuote ? initialQuote.vendorName : 'new'}
          need={need}
          initialQuote={initialQuote}
          onSave={handleSave}
          onCancel={onClose}
          onRequestDelete={onRemove ? () => setConfirmRemoveOpen(true) : undefined}
          isSubmitting={isSubmitting}
        />
      </Dialog>

      {confirmRemoveOpen && initialQuote && (
        <Dialog
          open={confirmRemoveOpen}
          onClose={() => setConfirmRemoveOpen(false)}
          title="Delete quote?"
        >
          <div className="space-y-4">
            <p className="text-sm text-[#5B4A5E]">
              Are you sure you want to delete the quote from &ldquo;{initialQuote.vendorName}&rdquo;?
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmRemoveOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRemove}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                {isSubmitting ? 'Deleting...' : 'Delete quote'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
