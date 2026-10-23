'use client';

import { CopyFallbackDialog } from '@/components/ui/CopyFallbackDialog';

export interface BriefFallbackDialogProps {
  open: boolean;
  onClose: () => void;
  brief: string;
}

export function BriefFallbackDialog({ open, onClose, brief }: BriefFallbackDialogProps) {
  return (
    <CopyFallbackDialog
      open={open}
      onClose={onClose}
      text={brief}
      title="Vendor inquiry brief"
      description="Copy this plain-text brief to email or message vendors. It excludes your private budget and host notes."
      ariaLabel="Vendor inquiry brief"
    />
  );
}
