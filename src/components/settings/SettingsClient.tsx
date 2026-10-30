'use client';

import { Card } from '@/components/ui/Card';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { PAGE_COPY } from '@/lib/copy';
import { AiModeSection } from './AiModeSection';
import { YourDataSection } from './YourDataSection';

export function SettingsClient() {
  return (
    <PageContainer width="narrow" className="space-y-8">
      <PageHeader
        title={PAGE_COPY.settings.title}
        description={PAGE_COPY.settings.description}
      />

      <AiModeSection />

      <YourDataSection />

      <section aria-labelledby="settings-about-heading" className="space-y-3">
        <h2
          id="settings-about-heading"
          className="text-xl font-serif font-bold text-ink"
        >
          About this app
        </h2>

        <Card className="p-5">
          <p className="text-sm text-ink-muted leading-relaxed">
            Momently calculates budgets using standard pricing for Indian city tiers (Metro, Tier-1, Tier-2) and marks every price as an Estimate, Your input, or a Verified quote so you always know where figures come from. Every simulation, schedule adjustment and export runs locally on your device, and Momently never contacts vendors or guests on your behalf.
          </p>
        </Card>
      </section>
    </PageContainer>
  );
}
