'use client';

import { useState } from 'react';
import type { PlanPatchOp, ScheduleSlot } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { engineContext } from '@/store/engineContext';

export interface SlotDialogProps {
  open: boolean;
  onClose: () => void;
  slot?: ScheduleSlot | null;
  eventId: string;
}

function minuteToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function timeToMinute(timeStr: string): number {
  const [h = 0, m = 0] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function validateSlotInput(
  title: string,
  duration: number,
  flexible: boolean,
  minDuration: number,
  startMinute: number,
): string | null {
  if (!title.trim()) return 'Title is required';
  if (duration < 5 || duration > 720) return 'Duration must be between 5 and 720 minutes';
  if (flexible && minDuration > duration) return 'Minimum duration cannot exceed total duration';
  if (startMinute + duration > 1440) return "A session can't run past midnight";
  return null;
}

function buildSlotOp(
  isEditing: boolean,
  slotId: string | undefined,
  trimmedTitle: string,
  startMinute: number,
  duration: number,
  priority: ScheduleSlot['priority'],
  flexible: boolean,
  minDuration: number,
  note: string,
): PlanPatchOp {
  const common = {
    title: trimmedTitle,
    startMinute,
    durationMinutes: duration,
    priority,
    flexible,
    minDurationMinutes: flexible ? minDuration : undefined,
    note: note.trim() || undefined,
  };
  if (isEditing && slotId) {
    return { type: 'update_slot', id: slotId, changes: common };
  }
  return { type: 'add_slot', slot: { id: engineContext.ids('slot'), ...common } };
}

function initialSlotValues(slot: ScheduleSlot | null | undefined) {
  if (slot) {
    return {
      title: slot.title,
      timeStr: minuteToTime(slot.startMinute),
      duration: slot.durationMinutes,
      priority: slot.priority,
      flexible: slot.flexible,
      minDuration: slot.minDurationMinutes ?? Math.max(5, Math.round(slot.durationMinutes * 0.7)),
      note: slot.note ?? '',
    };
  }
  return {
    title: '',
    timeStr: '10:00',
    duration: 45,
    priority: 'important' as const,
    flexible: true,
    minDuration: 30,
    note: '',
  };
}

function RemoveSlotConfirmDialog({
  open,
  title,
  isEssential,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  isEssential: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Remove Session?" description="Are you sure you want to remove this activity from the timeline?">
      <div className="space-y-4 py-2">
        {isEssential && (
          <Alert tone="warning">Warning: This is an Essential session. Removing it may impact key celebration moments.</Alert>
        )}
        <p className="text-sm text-[#5B4A5E]">Removing &ldquo;{title}&rdquo; cannot be undone without restoring a saved version.</p>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E6DCD2]">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Confirm Remove</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function SlotDialog({ open, onClose, slot, eventId }: SlotDialogProps) {
  const { applyEdit } = useUserEdit(eventId);
  const isEditing = Boolean(slot);
  const initial = initialSlotValues(slot);

  const [title, setTitle] = useState(initial.title);
  const [timeStr, setTimeStr] = useState(initial.timeStr);
  const [duration, setDuration] = useState(initial.duration);
  const [priority, setPriority] = useState<ScheduleSlot['priority']>(initial.priority);
  const [flexible, setFlexible] = useState(initial.flexible);
  const [minDuration, setMinDuration] = useState(initial.minDuration);
  const [note, setNote] = useState(initial.note);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const handleSave = async () => {
    const startMinute = timeToMinute(timeStr);
    const validationErr = validateSlotInput(title, duration, flexible, minDuration, startMinute);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    const trimmedTitle = title.trim();
    const op = buildSlotOp(
      isEditing,
      slot?.id,
      trimmedTitle,
      startMinute,
      duration,
      priority,
      flexible,
      minDuration,
      note,
    );

    const ok = await applyEdit([op], isEditing ? `Edit slot ${trimmedTitle}` : `Add slot ${trimmedTitle}`);
    if (ok) {
      onClose();
    } else {
      setError("Failed to save slot changes. A session can't run past midnight.");
    }
  };

  const handleRemove = async () => {
    if (!slot) return;
    const ok = await applyEdit([{ type: 'remove_slot', id: slot.id }], `Remove slot ${slot.title}`);
    if (ok) {
      setConfirmRemoveOpen(false);
      onClose();
    }
  };

  return (
    <>
      <Dialog
        open={open && !confirmRemoveOpen}
        onClose={onClose}
        title={isEditing ? 'Edit Activity Slot' : 'Add Activity Slot'}
        description="Configure start time, duration, and flex constraints for this milestone."
      >
        <div className="space-y-4 py-2">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Activity Title" required>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grand Entrance" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time" required>
              <input
                id="slot-start-time"
                aria-label="Start Time"
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] border border-[#E6DCD2] bg-white text-[#2B1B2E] text-base"
              />
            </Field>
            <Field label="Duration (mins)" required>
              <NumberInput min={5} max={720} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as ScheduleSlot['priority'])}>
              <option value="essential">Essential (Cannot be compressed or moved)</option>
              <option value="important">Important</option>
              <option value="optional">Optional</option>
            </Select>
          </Field>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[#2B1B2E]">
              <input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} className="rounded border-[#E6DCD2]" />
              <span>Can flex (can be shortened or moved during delays)</span>
            </label>
            {flexible && (
              <Field label="Minimum Duration (mins)">
                <NumberInput min={5} max={duration} step={5} value={minDuration} onChange={(e) => setMinDuration(Number(e.target.value))} />
              </Field>
            )}
          </div>
          <Field label="Notes (optional)">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Photographer needed on stage" />
          </Field>
          <div className="flex items-center justify-between pt-3 border-t border-[#E6DCD2]">
            {isEditing ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmRemoveOpen(true)}>Remove</Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleSave}>{isEditing ? 'Save changes' : 'Add session'}</Button>
            </div>
          </div>
        </div>
      </Dialog>

      <RemoveSlotConfirmDialog
        open={confirmRemoveOpen}
        title={slot?.title ?? ''}
        isEssential={slot?.priority === 'essential'}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={handleRemove}
      />
    </>
  );
}
