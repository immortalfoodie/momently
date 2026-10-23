'use client';

import type { EventPlan } from '@/domain/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatMinuteOfDay } from '@/lib/format';
import { minuteToTimeInput, parseTimeInput } from '@/lib/time';

export interface ModeBannerProps {
  plan: EventPlan;
  mode: 'live' | 'practice';
  minute: number;
  canGoLive: boolean;
  onGoLive: () => void;
  onPractice: () => void;
  onSetPracticeMinute: (minute: number) => void;
  onNudge: (delta: number) => void;
  className?: string;
}

function formatDisplayDate(dateIso?: string): string {
  if (!dateIso) return '';
  const parts = dateIso.slice(0, 10).split('-').map(Number);
  const y = parts[0] ?? 2026;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ModeBanner({
  plan,
  mode,
  minute,
  canGoLive,
  onGoLive,
  onPractice,
  onSetPracticeMinute,
  onNudge,
  className = '',
}: ModeBannerProps) {
  if (mode === 'live') {
    return (
      <Card className={`p-4 bg-[#F5F2EB] border border-[#E6DCD2] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2.5">
          <Badge tone="success">Live</Badge>
          <span className="text-lg font-bold text-[#2B1B2E]">
            Live: it&apos;s {formatMinuteOfDay(minute)}
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={onPractice} className="min-h-[44px]">
          Practise run-of-show
        </Button>
      </Card>
    );
  }

  const dateFormatted = formatDisplayDate(plan.meta.dateIso);

  return (
    <Card className={`p-4 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Badge tone="warning">Practice mode</Badge>
          <span className="text-sm font-semibold text-[#5B4A5E]">
            Simulated clock: {formatMinuteOfDay(minute)}
          </span>
        </div>
        {canGoLive && (
          <Button variant="primary" size="sm" onClick={onGoLive} className="min-h-[44px]">
            Go live
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-[#2B1B2E]">
          <span>Pretend it&apos;s</span>
          <input
            type="time"
            aria-label="Pretend it's"
            value={minuteToTimeInput(minute)}
            onChange={(e) => {
              const m = parseTimeInput(e.target.value);
              if (m !== undefined) onSetPracticeMinute(m);
            }}
            className="min-h-[44px] px-3 py-1.5 rounded-[12px] border border-[#E6DCD2] bg-white text-base text-[#2B1B2E] font-medium"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onNudge(-15)} className="min-h-[44px]">
            -15 min
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNudge(15)} className="min-h-[44px]">
            +15 min
          </Button>
        </div>
      </div>

      <p className="text-xs text-[#7A6B7E]">
        {plan.meta.dateIso
          ? `Live mode starts on the day of your event (${dateFormatted}). Practise your run of show any time.`
          : 'Set your event date on the overview page to unlock live mode on the day. Practise your run of show any time.'}
      </p>
    </Card>
  );
}
