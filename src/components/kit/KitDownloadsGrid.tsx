'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { budgetCsv } from '@/lib/export/budgetCsv';
import { checklistCsv } from '@/lib/export/checklistCsv';
import { downloadText } from '@/lib/export/download';
import { safeFilename } from '@/lib/export/filename';
import { buildIcs } from '@/lib/export/ics';
import { engineContext } from '@/store/engineContext';

export interface KitDownloadsGridProps {
  plan: EventPlan;
  eventId: string;
}

function getIcsDisabledReason(plan: EventPlan): string | null {
  if (!plan.meta.dateIso) {
    return 'Set an event date first';
  }
  if (plan.schedule.length === 0) {
    return 'Add at least one session to the timeline';
  }
  return null;
}

export function KitDownloadsGrid({ plan, eventId }: KitDownloadsGridProps) {
  const { announce } = useAnnouncer();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const icsReason = getIcsDisabledReason(plan);

  const handleBudgetDownload = () => {
    setErrorMsg(null);
    const filename = safeFilename(`${plan.meta.title}-budget`, 'csv');
    const content = budgetCsv(plan);
    const res = downloadText(filename, 'text/csv;charset=utf-8', content, { bom: true });
    if (res.ok) {
      announce(`Downloaded ${res.value.filename}`);
    } else {
      setErrorMsg(res.error.message);
    }
  };

  const handleChecklistDownload = () => {
    setErrorMsg(null);
    const filename = safeFilename(`${plan.meta.title}-checklist`, 'csv');
    const content = checklistCsv(plan, engineContext.clock());
    const res = downloadText(filename, 'text/csv;charset=utf-8', content, { bom: true });
    if (res.ok) {
      announce(`Downloaded ${res.value.filename}`);
    } else {
      setErrorMsg(res.error.message);
    }
  };

  const handleIcsDownload = () => {
    setErrorMsg(null);
    const icsRes = buildIcs(plan, engineContext.clock());
    if (!icsRes.ok) {
      setErrorMsg(icsRes.error.message);
      return;
    }
    const filename = safeFilename(plan.meta.title, 'ics');
    const res = downloadText(filename, 'text/calendar;charset=utf-8', icsRes.value);
    if (res.ok) {
      announce(`Downloaded ${res.value.filename}`);
    } else {
      setErrorMsg(res.error.message);
    }
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-[12px] bg-[#FBE9EB] border border-[#F4C5CB] text-sm text-[#A12B3A]"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Printable plan */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-serif font-bold text-[#2B1B2E]">Printable plan</h2>
            <p className="text-sm text-[#5B4A5E]">
              Clean, black-on-white summary of your budget, run of show, checklist and assumptions for printing or saving as PDF.
            </p>
          </div>
          <div>
            <LinkButton
              href={`/events/${eventId}/kit/plan`}
              variant="primary"
              className="min-h-[44px]"
            >
              Open printable plan
            </LinkButton>
          </div>
        </Card>

        {/* 2. Budget spreadsheet (CSV) */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-serif font-bold text-[#2B1B2E]">
              Budget spreadsheet (CSV)
            </h2>
            <p className="text-sm text-[#5B4A5E]">
              All line items with raw INR figures and price sources. Opens in Excel or Google Sheets.
            </p>
          </div>
          <div>
            <Button
              type="button"
              variant="secondary"
              icon={<Icon name="download" size={16} aria-hidden="true" />}
              onClick={handleBudgetDownload}
              className="min-h-[44px]"
            >
              Download budget CSV
            </Button>
          </div>
        </Card>

        {/* 3. Checklist (CSV) */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-serif font-bold text-[#2B1B2E]">Checklist (CSV)</h2>
            <p className="text-sm text-[#5B4A5E]">
              Every task ordered by due date and priority for sharing with family or coordinators.
            </p>
          </div>
          <div>
            <Button
              type="button"
              variant="secondary"
              icon={<Icon name="download" size={16} aria-hidden="true" />}
              onClick={handleChecklistDownload}
              className="min-h-[44px]"
            >
              Download checklist CSV
            </Button>
          </div>
        </Card>

        {/* 4. Calendar file (.ics) */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-serif font-bold text-[#2B1B2E]">Calendar file (.ics)</h2>
            <p className="text-sm text-[#5B4A5E]">
              Import every session from your run of show into Apple Calendar, Google Calendar or Outlook.
            </p>
            {icsReason ? (
              <p className="text-xs font-medium text-[#8A5A00] pt-1">{icsReason}</p>
            ) : (
              <p className="text-xs text-[#5B4A5E] pt-1">
                Times appear as local times in your calendar app: they aren&apos;t tied to a time zone.
              </p>
            )}
          </div>
          <div>
            <Button
              type="button"
              variant="secondary"
              icon={<Icon name="calendar" size={16} aria-hidden="true" />}
              disabled={Boolean(icsReason)}
              onClick={handleIcsDownload}
              className="min-h-[44px]"
            >
              Download calendar (.ics)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
