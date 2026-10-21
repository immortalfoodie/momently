import type { Provenance } from '@/domain/types';
import { Icon } from './Icon';

export interface ProvenanceBadgeProps {
  provenance: Provenance;
  className?: string;
}

interface ProvenanceConfig {
  label: string;
  toneClass: string;
  iconName: 'users' | 'sparkle' | 'check';
}

const CONFIG: Record<Provenance, ProvenanceConfig> = {
  user: {
    label: 'Your input',
    toneClass: 'bg-[#F4EDE6] text-[#6B2D5C] border-[#E2D2DC]',
    iconName: 'users',
  },
  estimate: {
    label: 'Estimate',
    toneClass: 'bg-[#FFF4DC] text-[#8A5A00] border-[#FFE2A8]',
    iconName: 'sparkle',
  },
  verified: {
    label: 'Verified quote',
    toneClass: 'bg-[#E7F4EE] text-[#1F6F54] border-[#C3E6D7]',
    iconName: 'check',
  },
};

/**
 * Visual and accessible provenance badge for budget items.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Avoids hover-only tooltips (which fail on mobile touches and fail WCAG 1.4.13 Content on Hover).
 * Instead, renders an inline badge pairing an icon with persistent, unambiguous text so all users
 * immediately comprehend cost source authenticity.
 */
export function ProvenanceBadge({ provenance, className = '' }: ProvenanceBadgeProps) {
  const conf = CONFIG[provenance] ?? CONFIG.estimate;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${conf.toneClass} ${className}`}
      aria-label={`Cost source: ${conf.label}`}
    >
      <Icon name={conf.iconName} size={13} aria-hidden="true" />
      <span>{conf.label}</span>
    </span>
  );
}
