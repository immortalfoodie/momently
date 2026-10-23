import { Icon } from '@/components/ui/Icon';

export interface PrivacyNoteProps {
  className?: string;
}

/**
 * Explains the strict counts-only privacy guarantee to hosts.
 * WHY: Reassures hosts and ensures guest personal details or names never enter the system.
 */
export function PrivacyNote({ className = '' }: PrivacyNoteProps) {
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-[12px] bg-[#F5F2EB] border border-[#E6DCD2] flex items-start gap-3 ${className}`}
      role="note"
      aria-label="Privacy note"
    >
      <Icon
        name="info"
        size={20}
        className="text-[#6B2D5C] shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <p className="text-xs sm:text-sm text-[#5B4A5E] leading-relaxed">
        Momently keeps counts only: never guest names or personal details. Please don&apos;t type names into any field.
      </p>
    </div>
  );
}
