'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useEventsStore } from '@/store/eventsStore';

export interface MakeItYoursCardProps {
  className?: string;
}

const SAMPLE_PROMPT =
  'Combine the decorations from option 2 with the atmosphere of option 1, but make it 20% cheaper';

/**
 * MakeItYoursCard empowers hosts to personalize and fuse concept directions.
 *
 * INTERACTION DECISION (WHY):
 * Populates chatDraft in the local store without navigating away or opening modal flows,
 * seamlessly preparing natural language intent for the conversation assistant.
 */
export function MakeItYoursCard({ className = '' }: MakeItYoursCardProps) {
  const setChatDraft = useEventsStore((s) => s.setChatDraft);
  const [copied, setCopied] = useState(false);

  const handleUsePrompt = () => {
    setChatDraft(SAMPLE_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Card className={`p-4 border-[#E2D2DC] bg-[#FAF5F0] space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-[#F4EDE6] text-[#6B2D5C] shrink-0">
          <Icon name="sparkle" size={20} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[#2B1B2E]">Make it yours</h2>
          <p className="text-xs text-[#5C4556] leading-relaxed">
            Want elements from multiple concepts? You can customize and fuse ideas in the assistant:
          </p>
          <blockquote className="p-2 rounded bg-white border border-[#E6DCD2] text-xs font-mono text-[#6B2D5C]">
            &ldquo;{SAMPLE_PROMPT}&rdquo;
          </blockquote>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleUsePrompt}
          icon={<Icon name={copied ? 'check' : 'sparkle'} size={14} aria-hidden="true" />}
        >
          {copied ? 'Prompt copied to assistant draft' : 'Try this request in chat'}
        </Button>
      </div>
    </Card>
  );
}
