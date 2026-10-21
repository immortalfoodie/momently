import { formatInr } from '@/lib/format';
import { Icon } from './Icon';

export interface ProgressMeterProps {
  value: number;
  max: number;
  min?: number;
  label?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Budget progress meter with explicit semantic accessibility attributes.
 *
 * ACCESSIBILITY DECISION (WHY):
 * 1. Uses `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext`.
 * 2. Visual & non-visual status: When exceeding 90% or 100%, changes color AND explicitly appends
 *    an icon (`alert`) and textual status ("Near budget cap" or "Over budget"). Color alone is never used.
 */
function getMeterStatus(value: number, max: number, percentage: number) {
  if (value > max) {
    return {
      barColor: 'bg-[#A12B3A]',
      statusColor: 'text-[#A12B3A]',
      icon: 'alert' as const,
      text: 'Over budget',
      isStrong: true,
    };
  }
  if (percentage >= 90) {
    return {
      barColor: 'bg-[#8A5A00]',
      statusColor: 'text-[#8A5A00]',
      icon: 'alert' as const,
      text: 'Near budget cap',
      isStrong: true,
    };
  }
  return {
    barColor: 'bg-[#1F6F54]',
    statusColor: 'text-[#1F6F54]',
    icon: 'check' as const,
    text: 'On track',
    isStrong: false,
  };
}

/**
 * Budget progress meter with explicit semantic accessibility attributes.
 *
 * ACCESSIBILITY DECISION (WHY):
 * 1. Uses `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext`.
 * 2. Visual & non-visual status: When exceeding 90% or 100%, changes color AND explicitly appends
 *    an icon (`alert`) and textual status ("Near budget cap" or "Over budget"). Color alone is never used.
 */
export function ProgressMeter({
  value,
  max,
  min = 0,
  label,
  className = '',
  'aria-label': ariaLabel = 'Budget utilization meter',
}: ProgressMeterProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const status = getMeterStatus(value, max, percentage);
  const defaultLabel = `${formatInr(value)} of ${formatInr(max)} (${percentage}%)`;
  const visibleLabel = label ?? defaultLabel;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between gap-2 text-sm font-medium mb-1.5">
        <span className="text-[#2B1B2E]">{visibleLabel}</span>
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            status.isStrong ? 'font-semibold' : 'font-medium'
          } ${status.statusColor}`}
        >
          <Icon name={status.icon} size={14} aria-hidden="true" />
          <span>{status.text}</span>
        </span>
      </div>

      <div
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${percentage}% of budget used`}
        className="w-full h-3 rounded-full bg-[#E6DCD2] overflow-hidden"
      >
        <div
          className={`h-full transition-all duration-300 motion-reduce:transition-none rounded-full ${status.barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}
