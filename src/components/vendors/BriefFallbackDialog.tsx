'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextArea } from '@/components/ui/TextArea';

export interface BriefFallbackDialogProps {
  open: boolean;
  onClose: () => void;
  brief: string;
}

export function BriefFallbackDialog({ open, onClose, brief }: BriefFallbackDialogProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSelectAll = () => {
    if (textRef.current) {
      textRef.current.select();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Vendor inquiry brief">
      <div className="space-y-4">
        <p className="text-xs text-[#5B4A5E]">
          Copy this plain-text brief to email or message vendors. It excludes your private budget and host notes.
        </p>

        <TextArea
          ref={textRef}
          value={brief}
          readOnly
          rows={10}
          className="font-mono text-xs bg-[#FAF7F2]"
          aria-label="Vendor inquiry brief"
        />

        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="secondary" onClick={handleSelectAll} className="min-h-[44px]">
            Select all
          </Button>
          <Button type="button" variant="primary" onClick={onClose} className="min-h-[44px]">
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
