'use client';

import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { AiModeSection } from './AiModeSection';
import { YourDataSection } from './YourDataSection';

export function SettingsClient() {
  return (
    <div className="py-2 space-y-8 max-w-3xl mx-auto">
      <PageHeader
        title="Settings"
        description="AI mode, local data portability, and privacy controls."
      />

      <AiModeSection />

      <YourDataSection />

      <section aria-labelledby="settings-about-heading" className="space-y-3">
        <h2
          id="settings-about-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E]"
        >
          About this app
        </h2>

        <Card className="p-5">
          <p className="text-sm text-[#5B4A5E] leading-relaxed">
            Momently calculates budgets using deterministic Indian city-tier rate cards (Metro, Tier-1, Tier-2) and marks every price as an Estimate, Your input, or a Verified quote so you always know where figures come from. Every simulation, schedule adjustment and export runs locally on your device, and Momently never contacts vendors or guests on your behalf.
          </p>
        </Card>
      </section>
    </div>
  );
}
