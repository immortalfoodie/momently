'use client';

import { useState } from 'react';
import { BUDGET_CATEGORIES } from '@/domain/constants';
import type { BudgetCategory, BudgetItem } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';

export interface AddItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<BudgetItem, 'id'>) => void;
  prefill?: { category?: BudgetCategory; label?: string };
}

/**
 * AddItemDialog allowing hosts to manually insert custom budget items into their plan.
 * WHY: Supports user agency and seamless prefill conversion from forgotten cost reminders.
 */
export function AddItemDialog({
  isOpen,
  onClose,
  onAdd,
  prefill,
}: AddItemDialogProps) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('other');
  const [basis, setBasis] = useState<'flat' | 'per_guest'>('flat');
  const [unitCost, setUnitCost] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ label?: string; unitCost?: string }>({});

  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setLabel(prefill?.label ?? '');
      setCategory(prefill?.category ?? 'other');
      setBasis('flat');
      setUnitCost(0); // Price is NEVER prefilled per requirements
      setQuantity(1);
      setNote('');
      setErrors({});
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { label?: string; unitCost?: string } = {};

    if (!label.trim()) {
      newErrors.label = 'Please provide an item description.';
    }
    if (isNaN(unitCost) || unitCost < 0) {
      newErrors.unitCost = 'Please provide a valid non-negative price.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd({
      label: label.trim(),
      category,
      basis,
      unitCost: Math.round(unitCost),
      quantity: Math.max(1, Math.round(quantity)),
      provenance: 'user',
      locked: false,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Add Budget Line Item"
      description="Record a custom expense or convert an unpriced reminder into an active ledger line."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <Field
          label="Item description"
          id="add-item-label"
          error={errors.label}
          required
        >
          <TextInput
            id="add-item-label"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (errors.label) setErrors((prev) => ({ ...prev, label: undefined }));
            }}
            placeholder="e.g. Traditional Dholak player or Valet parking"
            required
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Category" id="add-item-category" required>
            <Select
              id="add-item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as BudgetCategory)}
            >
              {BUDGET_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cost basis" id="add-item-basis" required>
            <Select
              id="add-item-basis"
              value={basis}
              onChange={(e) => setBasis(e.target.value as 'flat' | 'per_guest')}
            >
              <option value="flat">Flat total</option>
              <option value="per_guest">Per guest</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Your price"
            id="add-item-price"
            hint={basis === 'per_guest' ? 'Price per attending guest (₹)' : 'Fixed flat cost (₹)'}
            error={errors.unitCost}
            required
          >
            <NumberInput
              id="add-item-price"
              value={unitCost || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                setUnitCost(isNaN(val) ? 0 : val);
                if (errors.unitCost)
                  setErrors((prev) => ({ ...prev, unitCost: undefined }));
              }}
              min={0}
              step={basis === 'per_guest' ? 50 : 1000}
              required
            />
          </Field>

          <Field label="Quantity" id="add-item-quantity" required>
            <NumberInput
              id="add-item-quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              min={1}
              step={1}
              required
            />
          </Field>
        </div>

        <Field label="Planning note" id="add-item-note">
          <TextInput
            id="add-item-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Optional context, vendor name, or contract details"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E6DCD2]">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Add to Budget
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
