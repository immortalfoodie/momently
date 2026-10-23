'use client';

import { useState } from 'react';
import type { ConstraintKind, ConstraintSeverity } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';

export interface AddPreferenceDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (preference: {
    kind: ConstraintKind;
    description: string;
    severity: ConstraintSeverity;
  }) => void;
}

const KIND_OPTIONS: { value: ConstraintKind; label: string }[] = [
  { value: 'must_have', label: 'Must have (e.g. DJ, live band, photo booth)' },
  { value: 'avoid', label: 'Avoid (e.g. no loud music after 10 PM)' },
  { value: 'style', label: 'Style or theme requirement' },
  { value: 'dietary', label: 'Dietary or culinary tradition' },
  { value: 'accessibility', label: 'Accessibility requirement' },
  { value: 'venue', label: 'Venue or layout requirement' },
];

export function AddPreferenceDialog({ open, onClose, onSave }: AddPreferenceDialogProps) {
  const [kind, setKind] = useState<ConstraintKind>('must_have');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ConstraintSeverity>('hard');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) {
      setError('Please provide a description.');
      return;
    }
    if (trimmed.length > 200) {
      setError('Description cannot exceed 200 characters.');
      return;
    }

    onSave({ kind, description: trimmed, severity });
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add tradition or requirement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Category of requirement">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as ConstraintKind)}
            aria-label="Category of requirement"
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Description"
          hint="Tell us what you want respected. Please don't include personal names."
          error={error ?? undefined}
        >
          <TextInput
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Traditional shehnai at the entrance"
            maxLength={200}
            aria-label="Description"
          />
        </Field>

        <Field label="Priority / strictness">
          <Select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as ConstraintSeverity)}
            aria-label="Priority strictness"
          >
            <option value="hard">Must respect (non-negotiable)</option>
            <option value="soft">Nice to have (flexible)</option>
          </Select>
        </Field>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="min-h-[44px]">
            Save requirement
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
