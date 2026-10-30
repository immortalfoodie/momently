import { formatInr } from '@/lib/format';
import { Icon } from './Icon';

export type ProgressMeterVariant = 'budget' | 'progress';

export interface ProgressMeterProps {
  value: number;
  max: number;
  min?: number;
  label?: string;
  variant?: ProgressMeterVariant;
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
      barColor: 'bg-danger',
      statusColor: 'text-danger',
      icon: 'alert' as const,
      text: 'Over budget',
      isStrong: true,
    };
  }
  if (percentage >= 90) {
    return {
      barColor: 'bg-warning',
      statusColor: 'text-warning',
      icon: 'alert' as const,
      text: 'Near budget cap',
      isStrong: true,
    };
  }
  return {
    barColor: 'bg-success',
    statusColor: 'text-success',
    icon: 'check' as const,
    text: 'On track',
    isStrong: false,
  };
}

function getProgressStatus(value: number, max: number, percentage: number) {
  if (value === 0 || max === 0) {
    return {
      barColor: 'bg-ink-muted',
      statusColor: 'text-ink-muted',
      icon: null,
      text: 'Not started',
      isStrong: false,
    };
  }
  if (value >= max) {
    return {
      barColor: 'bg-success',
      statusColor: 'text-success',
      icon: 'check' as const,
      text: 'Complete',
      isStrong: true,
    };
  }
  return {
    barColor: 'bg-primary',
    statusColor: 'text-primary',
    icon: null,
    text: `${percentage}% done`,
    isStrong: false,
  };
}

function resolveProgressLabels(
  variant: ProgressMeterVariant,
  value: number,
  max: number,
  percentage: number,
  statusText: string,
  label?: string,
  ariaLabel?: string,
) {
  if (variant === 'budget') {
    return {
      visibleLabel: label ?? `${formatInr(value)} of ${formatInr(max)} (${percentage}%)`,
      ariaLabel: ariaLabel ?? 'Budget progress meter',
      ariaValueText: `${percentage}% of budget used`,
    };
  }
  return {
    visibleLabel: label ?? `${value} of ${max} (${percentage}%)`,
    ariaLabel: ariaLabel ?? 'Task completion progress',
    ariaValueText: statusText,
  };
}

/**
 * Progress meter with support for both budget utilization and task completion semantics.
 *
 * ACCESSIBILITY DECISION (WHY):
 * 1. Uses `role="meter"` with standard ARIA range attributes.
 * 2. In 'progress' mode, replaces financial wording with clear milestone phrasing
 *    ("Not started", "N% done", "Complete" with check icon) and accessible text indicators.
 */
export function ProgressMeter({
  value,
  max,
  min = 0,
  label,
  variant = 'budget',
  className = '',
  'aria-label': ariaLabel,
}: ProgressMeterProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const isBudget = variant === 'budget';
  const status = isBudget
    ? getMeterStatus(value, max, percentage)
    : getProgressStatus(value, max, percentage);

  const { visibleLabel, ariaLabel: resolvedAriaLabel, ariaValueText: resolvedAriaValueText } =
    resolveProgressLabels(variant, value, max, percentage, status.text, label, ariaLabel);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between gap-2 text-sm font-medium mb-1.5">
        <span className="text-ink">{visibleLabel}</span>
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            status.isStrong ? 'font-semibold' : 'font-medium'
          } ${status.statusColor}`}
        >
          {status.icon && <Icon name={status.icon} size={14} aria-hidden="true" />}
          <span>{status.text}</span>
        </span>
      </div>

      <div
        role="meter"
        aria-label={resolvedAriaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={resolvedAriaValueText}
        className="w-full h-3 rounded-full bg-border overflow-hidden"
      >
        <div
          className={`h-full transition-all duration-300 motion-reduce:transition-none rounded-full ${status.barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}
