'use client';

import { useId, useState } from 'react';
import type { PlanPatchOp, Task } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextInput } from '@/components/ui/TextInput';
import { engineContext } from '@/store/engineContext';

export interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  existingCategories: string[];
  eventId: string;
}

function validateTaskInput(title: string, category: string, dueDaysBefore: number): string | null {
  if (!title.trim()) return 'Task title is required';
  if (!category.trim()) return 'Category is required';
  if (dueDaysBefore < 0 || dueDaysBefore > 730) return 'Due days before must be between 0 and 730';
  return null;
}

function initialTaskValues(task: Task | null | undefined, defaultCategory: string) {
  if (task) {
    return {
      title: task.title,
      category: task.category,
      dueDaysBefore: task.dueDaysBefore,
      priority: task.priority,
      notes: task.notes ?? '',
    };
  }
  return {
    title: '',
    category: defaultCategory,
    dueDaysBefore: 30,
    priority: 'medium' as const,
    notes: '',
  };
}

function RemoveTaskConfirmDialog({
  open,
  title,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Remove Task?"
      description="Are you sure you want to remove this task from your checklist?"
    >
      <div className="space-y-4 py-2">
        <p className="text-sm text-[#5B4A5E]">
          Removing &ldquo;{title}&rdquo; cannot be undone without restoring a saved version.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E6DCD2]">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Confirm Remove</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function TaskDialog({
  open,
  onClose,
  task,
  existingCategories,
  eventId,
}: TaskDialogProps) {
  const { applyEdit } = useUserEdit(eventId);
  const datalistId = useId();
  const isEditing = Boolean(task);
  const initial = initialTaskValues(task, existingCategories[0] ?? 'planning');

  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [dueDaysBefore, setDueDaysBefore] = useState(initial.dueDaysBefore);
  const [priority, setPriority] = useState<Task['priority']>(initial.priority);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const handleSave = async () => {
    const validationErr = validateTaskInput(title, category, dueDaysBefore);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    const trimmedTitle = title.trim();
    const trimmedCategory = category.trim().toLowerCase();
    const notesVal = notes.trim() || undefined;

    const ops: PlanPatchOp[] = isEditing && task
      ? [{
          type: 'update_task',
          id: task.id,
          changes: { title: trimmedTitle, category: trimmedCategory, dueDaysBefore, priority, notes: notesVal },
        }]
      : [{
          type: 'add_task',
          task: {
            id: engineContext.ids('task'),
            title: trimmedTitle,
            category: trimmedCategory,
            dueDaysBefore,
            status: 'todo',
            priority,
            notes: notesVal,
          },
        }];

    const desc = isEditing ? `Update task "${trimmedTitle}"` : `Add task "${trimmedTitle}"`;
    const ok = await applyEdit(ops, desc);
    if (ok) onClose();
    else setError(`Failed to ${isEditing ? 'update' : 'add'} task.`);
  };

  const handleRemove = async () => {
    if (!task) return;
    const ok = await applyEdit([{ type: 'remove_task', id: task.id }], `Remove task "${task.title}"`);
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
        title={isEditing ? 'Edit Task' : 'Add Task'}
        description="Configure checklist milestone, target schedule offset, and priority."
      >
        <div className="space-y-4 py-2">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Task Title" required>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Confirm wedding cake order" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Category" required>
              <TextInput
                list={datalistId}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. food, venue"
              />
              <datalist id={datalistId}>
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Due Days Before Event" required>
              <NumberInput min={0} max={730} value={dueDaysBefore} onChange={(e) => setDueDaysBefore(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])}>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </Select>
          </Field>
          <Field label="Notes (optional)">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Special instructions, contact info, or specifications" />
          </Field>
          <div className="flex items-center justify-between pt-3 border-t border-[#E6DCD2]">
            {isEditing ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmRemoveOpen(true)}>
                Remove
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={handleSave}>{isEditing ? 'Save changes' : 'Add task'}</Button>
            </div>
          </div>
        </div>
      </Dialog>

      <RemoveTaskConfirmDialog
        open={confirmRemoveOpen}
        title={task?.title ?? ''}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={handleRemove}
      />
    </>
  );
}
