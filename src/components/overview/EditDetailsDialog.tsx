'use client';

import { useState } from 'react';
import type { EventPlan, EventSetting, PlanImpact } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';

export interface EditDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  plan: EventPlan;
  onSaveSimple: (changes: { title?: string; city?: string; dateIso?: string }) => Promise<PlanImpact | null>;
  onTriggerComplexFlow: (changes: { guestCount?: number; setting?: EventSetting }) => void;
}

/**
 * EditDetailsDialog managing host parameter updates with two-phase routing.
 * WHY: Applies title/city/date immediately via set_meta while delegating headcount
 * and setting changes to the proposal engine for surge and conflict analysis.
 */
export function EditDetailsDialog({
  open,
  onClose,
  plan,
  onSaveSimple,
  onTriggerComplexFlow,
}: EditDetailsDialogProps) {
  const [title, setTitle] = useState(plan.meta.title);
  const [city, setCity] = useState(plan.meta.city);
  const [dateIso, setDateIso] = useState(plan.meta.dateIso ?? '');
  const [guestCount, setGuestCount] = useState(plan.meta.guestCount);
  const [setting, setSetting] = useState<EventSetting>(plan.meta.setting);
  const [errors, setErrors] = useState<{ title?: string; dateIso?: string }>({});

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTitle(plan.meta.title);
      setCity(plan.meta.city);
      setDateIso(plan.meta.dateIso ?? '');
      setGuestCount(plan.meta.guestCount);
      setSetting(plan.meta.setting);
      setErrors({});
    }
  }

  // eslint-disable-next-line complexity
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { title?: string; dateIso?: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Please provide an event title.';
    }

    const todayStr = new Date().toISOString().split('T')[0] ?? '2026-01-01';
    if (dateIso && dateIso < todayStr) {
      newErrors.dateIso = 'Event date cannot be in the past.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const simpleChanges: { title?: string; city?: string; dateIso?: string } = {};
    if (title.trim() !== plan.meta.title) simpleChanges.title = title.trim();
    if (city.trim() !== plan.meta.city) simpleChanges.city = city.trim();
    if (dateIso !== (plan.meta.dateIso ?? '')) simpleChanges.dateIso = dateIso || undefined;

    const complexChanges: { guestCount?: number; setting?: EventSetting } = {};
    if (guestCount !== plan.meta.guestCount) complexChanges.guestCount = guestCount;
    if (setting !== plan.meta.setting) complexChanges.setting = setting;

    // Apply simple changes first
    if (Object.keys(simpleChanges).length > 0) {
      await onSaveSimple(simpleChanges);
    }

    // Trigger complex flow if headcount or setting shifted
    if (Object.keys(complexChanges).length > 0) {
      onTriggerComplexFlow(complexChanges);
    }

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit Celebration Details"
      description="Update basic event parameters. Headcount or setting adjustments will be analyzed for resource conflicts."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <Field label="Event title" id="edit-details-title" error={errors.title} required>
          <TextInput
            id="edit-details-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            required
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Celebration type (read-only)" id="edit-details-type">
            <TextInput
              id="edit-details-type"
              value={plan.meta.type}
              disabled
              className="bg-[#F4EDE6] cursor-not-allowed capitalize text-[#5B4A5E]"
            />
          </Field>

          <Field label="Host city" id="edit-details-city" required>
            <TextInput
              id="edit-details-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai, Jaipur, Bengaluru"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Event date"
            id="edit-details-date"
            hint="Must be today or in the future"
            error={errors.dateIso}
          >
            <input
              type="date"
              id="edit-details-date"
              value={dateIso}
              onChange={(e) => {
                setDateIso(e.target.value);
                if (errors.dateIso) setErrors((prev) => ({ ...prev, dateIso: undefined }));
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] border border-[#E6DCD2] bg-white text-[#2B1B2E] text-base transition-colors hover:border-[#6B2D5C]/40 focus:border-[#6B2D5C]"
            />
          </Field>

          <Field label="Guest count" id="edit-details-guests" required>
            <NumberInput
              id="edit-details-guests"
              value={guestCount}
              onChange={(e) => setGuestCount(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
              min={1}
              max={5000}
              required
            />
          </Field>
        </div>

        <Field label="Venue setting" id="edit-details-setting" required>
          <Select
            id="edit-details-setting"
            value={setting}
            onChange={(e) => setSetting(e.target.value as EventSetting)}
          >
            <option value="indoor">Indoor (Hall / Banquet / Auditorium)</option>
            <option value="outdoor">Outdoor (Lawn / Terrace / Garden)</option>
            <option value="mixed">Mixed (Indoor & Outdoor spaces)</option>
            <option value="undecided">Undecided / Flexible</option>
          </Select>
        </Field>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E6DCD2]">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
