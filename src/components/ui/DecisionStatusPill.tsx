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
    toneClass: 'bg-[#F4EDE6] text-[#2B1B2E] border-[#E6DCD2]',
    iconName: 'lock',
  },
  proposed: {
    label: 'Proposed',
    toneClass: 'bg-[#E8F0F8] text-[#2B5C8A] border-[#C3DBEE]',
    iconName: 'sparkle',
  },
  'awaiting approval': {
    label: 'Awaiting approval',
    toneClass: 'bg-[#FFF4DC] text-[#8A5A00] border-[#FFE2A8]',
    iconName: 'clock',
  },
  approved: {
    label: 'Approved',
    toneClass: 'bg-[#E7F4EE] text-[#1F6F54] border-[#C3E6D7]',
    iconName: 'check',
  },
  rejected: {
    label: 'Rejected',
    toneClass: 'bg-[#FBE9EB] text-[#A12B3A] border-[#F4C5CB]',
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
