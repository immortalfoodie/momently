'use client';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useAiMode } from '@/lib/useAiMode';

type DisplayMode = 'Demo mode' | 'Live AI' | 'Offline';

const MODE_DESCRIPTIONS: Record<DisplayMode, string> = {
  'Demo mode':
    'Momently is running with built-in sample responses so you can explore every feature without an API key or external AI calls.',
  'Live AI':
    'Connected to Gemini for natural-language intake, concept ideas and optional plain-English explanations. All math, pricing and schedule changes still run locally in the pure engine.',
  Offline:
    'The AI service could not be reached right now. All local planning tools, budget calculations, timelines, checklists, chaos simulations and exports continue to work offline.',
};

const STATUS_TO_DISPLAY: Record<'live' | 'demo' | 'offline', DisplayMode> = {
  live: 'Live AI',
  demo: 'Demo mode',
  offline: 'Offline',
};

/**
 * Settings section explaining which AI is active and what data it receives.
 */
export function AiModeSection() {
  const { status, model } = useAiMode();
  const mode = STATUS_TO_DISPLAY[status];

  return (
    <section aria-labelledby="settings-ai-mode-heading" className="space-y-3">
      <h2
        id="settings-ai-mode-heading"
        className="text-xl font-serif font-bold text-[#2B1B2E]"
      >
        AI mode
      </h2>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[#2B1B2E]">
            Current mode:
          </span>
          <Badge tone={mode === 'Live AI' ? 'success' : mode === 'Offline' ? 'warning' : 'info'}>
            {mode}
          </Badge>
          {model && <span className="text-xs text-[#5B4A5E]">Model: {model}</span>}
        </div>

        <p className="text-sm text-[#5B4A5E] leading-relaxed">
          {MODE_DESCRIPTIONS[mode]}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E6DCD2]">
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
              What is sent to the AI service
            </h3>
            <ul className="list-disc list-inside text-sm text-[#2B1B2E] space-y-1">
              <li>
                The text you type to the assistant and a compact summary of your plan: numbers, categories and preferences.
              </li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
              What is never sent
            </h3>
            <ul className="list-disc list-inside text-sm text-[#2B1B2E] space-y-1">
              <li>
                Guest names, your contacts, vendor names and quotes.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </section>
  );
}
