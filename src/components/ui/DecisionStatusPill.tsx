import type { IconName } from './Icon';
import { Icon } from './Icon';

export type DecisionStatus =
  | 'locked'
  | 'proposed'
  | 'awaiting approval'
  | 'approved'
  | 'rejected';

export interface DecisionStatusPillProps {
  status: DecisionStatus;
  className?: string;
}

interface StatusConfig {
  label: string;
  toneClass: string;
  iconName: IconName;
}

const CONFIG: Record<DecisionStatus, StatusConfig> = {
  locked: {
    label: 'Locked',
    toneClass: 'bg-surface-muted text-ink border-border',
    iconName: 'lock',
  },
  proposed: {
    label: 'Proposed',
    toneClass: 'bg-info-bg text-info border-info-border',
    iconName: 'sparkle',
  },
  'awaiting approval': {
    label: 'Awaiting approval',
    toneClass: 'bg-warning-bg text-warning border-warning-border',
    iconName: 'clock',
  },
  approved: {
    label: 'Approved',
    toneClass: 'bg-success-bg text-success border-success-border',
    iconName: 'check',
  },
  rejected: {
    label: 'Rejected',
    toneClass: 'bg-danger-bg text-danger border-danger-border',
    iconName: 'close',
  },
};

/**
 * Status indicator pill for ledger decisions and proposals.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Never uses color alone to communicate state. Employs both semantic text ("Approved", "Locked")
 * and distinct icon shapes paired with high-contrast badge backgrounds.
 */
export function DecisionStatusPill({ status, className = '' }: DecisionStatusPillProps) {
  const conf = CONFIG[status] ?? CONFIG.proposed;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${conf.toneClass} ${className}`}
    >
      <Icon name={conf.iconName} size={12} aria-hidden="true" />
      <span>{conf.label}</span>
    </span>
  );
}
