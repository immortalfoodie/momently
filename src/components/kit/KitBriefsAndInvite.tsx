'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import type { CopyTextOptions } from '@/components/ui/useCopyText';
import {
  buildInvitationText,
  type InvitationTone,
} from '@/lib/export/invitation';
import { buildVendorBrief } from '@/lib/vendorBrief';

export interface KitBriefsAndInviteProps {
  plan: EventPlan;
  onCopy: (text: string, options?: CopyTextOptions) => Promise<boolean>;
}

const TONE_OPTIONS: { value: InvitationTone; label: string }[] = [
  { value: 'warm', label: 'Warm & welcoming' },
  { value: 'formal', label: 'Formal & traditional' },
  { value: 'playful', label: 'Playful & festive' },
];

export function KitBriefsAndInvite({ plan, onCopy }: KitBriefsAndInviteProps) {
  const [tone, setTone] = useState<InvitationTone>('warm');

  const invitationText = buildInvitationText(plan, tone);

  const handleCopyAllBriefs = async () => {
    const allText = plan.vendors
      .map((need) => buildVendorBrief(plan, need))
      .join('\n\n---\n\n');
    await onCopy(allText, {
      announceText: 'Copied all vendor briefs',
      title: 'All vendor briefs',
      description: 'Copy these inquiry briefs to share with vendors. They exclude your budget and private notes.',
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 5. Vendor briefs */}
      <Card className="p-5 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <h2 className="text-lg font-serif font-bold text-ink">Vendor briefs</h2>
            <p className="text-sm text-ink-muted">
              Ready-to-send inquiry briefs with your date, guest count and questions—without exposing your budget.
            </p>
          </div>

          {plan.vendors.length > 0 ? (
            <ul className="divide-y divide-border border-t border-b border-border">
              {plan.vendors.map((need) => {
                const label =
                  need.category.charAt(0).toUpperCase() + need.category.slice(1);
                return (
                  <li
                    key={need.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium text-ink">{label}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label={`Copy brief for ${label}`}
                      onClick={() =>
                        onCopy(buildVendorBrief(plan, need), {
                          announceText: `Copied ${label} brief`,
                          title: `Vendor brief: ${label}`,
                        })
                      }
                      className="min-h-[44px]"
                    >
                      Copy brief
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No vendor categories in this plan.</p>
          )}
        </div>

        {plan.vendors.length > 0 && (
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopyAllBriefs}
              className="min-h-[44px]"
            >
              Copy all briefs
            </Button>
          </div>
        )}
      </Card>

      {/* 6. Invitation text */}
      <Card className="p-5 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <h2 className="text-lg font-serif font-bold text-ink">Invitation text</h2>
            <p className="text-sm text-ink-muted">
              Draft invitation wording formatted from your event details and chosen concept.
            </p>
          </div>

          <Field label="Invitation tone">
            <Select
              value={tone}
              onChange={(e) => setTone(e.target.value as InvitationTone)}
              aria-label="Invitation tone"
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <TextArea
            value={invitationText}
            readOnly
            rows={7}
            aria-label="Invitation text preview"
            className="text-xs bg-bg"
          />

          <p className="text-xs text-ink-muted">
            Replace the [bracketed] parts with your own details.
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onCopy(invitationText, {
                announceText: 'Copied invitation text',
                title: 'Invitation text',
              })
            }
            className="min-h-[44px]"
          >
            Copy text
          </Button>
        </div>
      </Card>
    </div>
  );
}
