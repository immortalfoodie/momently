'use client';

import { useState } from 'react';
import type { EventPlan, ScheduleSlot } from '@/domain/types';
import { buildScheduleView } from '@/engine/scheduleView';
import { formatMinuteOfDay } from '@/lib/format';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SlotDialog } from './SlotDialog';

export interface RunOfShowProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

function priorityTone(priority: ScheduleSlot['priority']): BadgeTone {
  if (priority === 'essential') return 'danger';
  if (priority === 'important') return 'warning';
  return 'neutral';
}

function priorityLabel(priority: ScheduleSlot['priority']): string {
  if (priority === 'essential') return 'Essential';
  if (priority === 'important') return 'Important';
  return 'Optional';
}

export function RunOfShow({ plan, eventId, className = '' }: RunOfShowProps) {
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const view = buildScheduleView(plan);
  const spanHours = Math.floor(view.totalSpanMinutes / 60);
  const spanMins = view.totalSpanMinutes % 60;

  const handleEdit = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setDialogOpen(true);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {view.warnings.length > 0 && (
        <Alert tone="warning">
          <div className="font-semibold text-sm mb-1">Schedule Notice</div>
          <ul className="list-disc pl-4 space-y-1 text-xs">
            {view.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#5B4A5E] pb-2 border-b border-[#E6DCD2]">
        <span className="font-semibold text-sm text-[#2B1B2E]">
          Run-Sheet Sequence ({view.slots.length} milestones)
        </span>
        <span className="tabular-nums font-medium text-[#2B1B2E]">
          Total: {spanHours} hours {spanMins} minutes, slack {view.totalSlackMinutes} minutes
        </span>
      </div>

      <div className="flex gap-4">
        {/* Decorative timeline track */}
        <div className="hidden md:flex flex-col items-center pt-2 w-8 shrink-0 select-none" aria-hidden="true">
          {view.slots.map((sv, idx) => {
            const h = Math.min(80, Math.max(32, Math.round(sv.slot.durationMinutes * 0.6)));
            return (
              <div key={sv.slot.id} className="flex flex-col items-center w-full">
                {sv.gapBeforeMinutes > 0 && (
                  <div
                    className="w-1 border-l-2 border-dashed border-[#B8A898] my-1"
                    style={{ height: Math.min(40, Math.max(12, Math.round(sv.gapBeforeMinutes * 0.5))) }}
                    title={`${sv.gapBeforeMinutes}m gap`}
                  />
                )}
                <div
                  className="w-3 rounded-full bg-[#7C2D37]/30 border-2 border-[#7C2D37] flex items-center justify-center"
                  style={{ height: h }}
                />
                {idx < view.slots.length - 1 && sv.gapBeforeMinutes === 0 && (
                  <div className="w-0.5 h-3 bg-[#E6DCD2]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Ordered list */}
        <ol className="flex-1 space-y-3" aria-label="Run of show chronological schedule">
          {view.slots.map((sv) => {
            const { slot, endMinute, gapBeforeMinutes } = sv;
            const startTimeFormatted = formatMinuteOfDay(slot.startMinute);
            const endTimeFormatted = formatMinuteOfDay(endMinute);

            return (
              <li key={slot.id} className="space-y-1">
                {gapBeforeMinutes > 0 && (
                  <div className="text-[11px] font-medium text-[#8C7A8D] pl-3 py-1 flex items-center gap-1.5" aria-label={`Gap of ${gapBeforeMinutes} minutes`}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B8A898]" />
                    <span>{gapBeforeMinutes}m slack buffer</span>
                  </div>
                )}
                <Card className="p-4 bg-white border border-[#E6DCD2] hover:border-[#6B2D5C]/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#7C2D37] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#E6DCD2]">
                          {startTimeFormatted} – {endTimeFormatted}
                        </span>
                        <h3 className="font-semibold text-base text-[#2B1B2E]">{slot.title}</h3>
                        <Badge tone={priorityTone(slot.priority)} className="text-[10px]">
                          {priorityLabel(slot.priority)}
                        </Badge>
                        <Badge tone="neutral" className="text-[10px]">
                          {slot.flexible ? 'Can flex' : 'Fixed'}
                        </Badge>
                      </div>

                      {slot.note && (
                        <p className="text-xs text-[#5B4A5E] italic pl-1">{slot.note}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(slot)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>

      {dialogOpen && (
        <SlotDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditingSlot(null);
          }}
          slot={editingSlot}
          eventId={eventId}
        />
      )}
    </div>
  );
}
