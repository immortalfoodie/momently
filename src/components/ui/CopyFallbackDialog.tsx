'use client';

import { useRef } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextArea } from './TextArea';

export interface CopyFallbackDialogProps {
  open: boolean;
  onClose: () => void;
  text: string;
  title?: string;
  description?: string;
  ariaLabel?: string;
}

/**
 * Accessible fallback modal displayed when `navigator.clipboard.writeText` is unavailable or denied.
 * WHY: Ensures hosts can always select and copy exported text even in restricted webviews or HTTP contexts.
 */
export function CopyFallbackDialog({
  open,
  onClose,
  text,
  title = 'Copy text',
  description = 'Clipboard access was blocked. Select and copy the text below.',
  ariaLabel,
}: CopyFallbackDialogProps) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSelectAll = () => {
    if (textRef.current) {
      textRef.current.select();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-xs text-[#5B4A5E]">{description}</p>

        <TextArea
          ref={textRef}
          value={text}
          readOnly
          rows={10}
          className="font-mono text-xs bg-[#FAF7F2]"
          aria-label={ariaLabel ?? title}
        />

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSelectAll}
            className="min-h-[44px]"
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onClose}
            className="min-h-[44px]"
          >
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
