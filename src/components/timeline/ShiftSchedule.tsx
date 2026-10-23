'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { shiftSlots } from '@/engine/schedule';
import { formatMinuteOfDay } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';

export interface ShiftScheduleProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

export function ShiftSchedule({ plan, eventId, className = '' }: ShiftScheduleProps) {
  const { applyEdit } = useUserEdit(eventId);
  const [deltaMinutes, setDeltaMinutes] = useState(15);
  const [anchorId, setAnchorId] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sortedSlots = [...plan.schedule].sort((a, b) => a.startMinute - b.startMinute);

  const handleShift = async () => {
    setError(null);
    setSuccess(null);

    if (deltaMinutes === 0) {
      setError('Please choose a non-zero shift amount.');
      return;
    }

    let fromMinute = 0;
    if (anchorId !== '0') {
      const targetSlot = sortedSlots.find((s) => s.id === anchorId);
      if (targetSlot) {
        fromMinute = targetSlot.startMinute;
      }
    }

    const testShift = shiftSlots(plan.schedule, fromMinute, deltaMinutes);
    if (!testShift.ok) {
      setError('Shifted schedule slots would breach 00:00 to 24:00 boundary. Nothing was saved.');
      return;
    }

    const ok = await applyEdit(
      [{ type: 'shift_schedule', fromMinute, deltaMinutes }],
      `Shift schedule by ${deltaMinutes > 0 ? `+${deltaMinutes}` : deltaMinutes} minutes`,
    );

    if (ok) {
      setSuccess(`Successfully shifted schedule by ${deltaMinutes > 0 ? `+${deltaMinutes}` : deltaMinutes} minutes.`);
      setDeltaMinutes(15);
    } else {
      setError("Shifted schedule slots would breach 00:00 to 24:00 boundary. Nothing was saved.");
    }
  };

  return (
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div>
        <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">Move the whole schedule</h3>
        <p className="text-xs text-[#5B4A5E] mt-0.5">
          Push all or later activities forward or backward by a set duration without altering relative gaps.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Shift amount (minutes)">
          <NumberInput
            min={-240}
            max={240}
            step={15}
            value={deltaMinutes}
            onChange={(e) => setDeltaMinutes(Number(e.target.value))}
            aria-label="Shift amount in minutes"
          />
        </Field>

        <Field label="Starting anchor">
          <Select
            value={anchorId}
            onChange={(e) => setAnchorId(e.target.value)}
            aria-label="Starting anchor slot"
          >
            <option value="0">From the start of the day</option>
            {sortedSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                From {slot.title} ({formatMinuteOfDay(slot.startMinute)})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end pt-2 border-t border-[#E6DCD2]">
        <Button variant="secondary" onClick={handleShift}>
          Apply Shift
        </Button>
      </div>
    </Card>
  );
}
