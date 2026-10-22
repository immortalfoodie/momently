'use client';

import { useState } from 'react';
import type { BudgetItem, Provenance } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { TextInput } from '@/components/ui/TextInput';

export interface EditPriceDialogProps {
  item: BudgetItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (unitCost: number, provenance: Provenance, note?: string) => void;
}

/**
 * EditPriceDialog allowing hosts to adjust unit costs, specify vendor confirmation, and add notes.
 * WHY: Provides explicit host input capture with inline validation before applying plan patches.
 */
export function EditPriceDialog({
  item,
  isOpen,
  onClose,
  onSave,
}: EditPriceDialogProps) {
  const [unitCost, setUnitCost] = useState<number>(0);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [prevItem, setPrevItem] = useState<BudgetItem | null>(item);

  if (item !== prevItem) {
    setPrevItem(item);
    if (item) {
      setUnitCost(item.unitCost);
      setIsVerified(item.provenance === 'verified');
      setNote(item.note ?? '');
      setError(null);
    }
  }

  if (!item) return null;

  const isPerGuest = item.basis === 'per_guest';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(unitCost) || unitCost < 0) {
      setError('Please enter a valid non-negative price.');
      return;
    }
    const provenance: Provenance = isVerified ? 'verified' : 'user';
    onSave(Math.round(unitCost), provenance, note.trim() || undefined);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={`Edit Price: ${item.label}`}
      description="Update expenditure details, record vendor confirmation, or leave planning notes."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <Field
          id="edit-unit-cost"
          label="Your price"
          hint={
            isPerGuest
              ? 'Price per guest (₹) · will scale with guest count'
              : 'Flat fixed total (₹)'
          }
          error={error ?? undefined}
          required
        >
          <NumberInput
            value={unitCost}
            onChange={(e) => {
              setUnitCost(Number(e.target.value));
              if (error) setError(null);
            }}
            min={0}
            step={isPerGuest ? 50 : 1000}
            required
            autoFocus
          />
        </Field>

        <div className="flex items-start gap-2.5 pt-1">
          <input
            id="edit-is-verified"
            type="checkbox"
            checked={isVerified}
            onChange={(e) => setIsVerified(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#E6DCD2] text-[#6B2D5C] focus:ring-[#1D4F91]"
          />
          <label htmlFor="edit-is-verified" className="text-sm font-medium text-[#2B1B2E]">
            This is a confirmed quote from the vendor
            <span className="block text-xs font-normal text-[#5B4A5E]">
              Marks this expense with a green verified badge and locks in real vendor quotes.
            </span>
          </label>
        </div>

        <Field
          id="edit-note"
          label="Planning note"
          hint="Optional reminder or context (e.g. includes tax & setup)"
        >
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="e.g. Quote includes 18% GST and basic delivery"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E6DCD2]">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save Price
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
