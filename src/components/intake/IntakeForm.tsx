'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextArea } from '@/components/ui/TextArea';
import { submitIntake, type ClientError } from '@/lib/apiClient';
import { useEventsStore } from '@/store/eventsStore';

interface SampleChip {
  id: string;
  label: string;
  typeMatch: string;
  text: string;
}

const SAMPLE_BRIEFS: SampleChip[] = [
  {
    id: 'anniversary',
    label: "Parents' 25th Anniversary",
    typeMatch: 'anniversary',
    text: DEMO_SCENARIO.hostBrief,
  },
  {
    id: 'birthday',
    label: "10th Birthday Party",
    typeMatch: 'birthday',
    text: "Planning my daughter's 10th birthday party in Bangalore. Around 40 guests, budget ₹60,000. She wants a magical Harry Potter theme, outdoor games, and a customized chocolate cake.",
  },
  {
    id: 'wedding',
    label: "Traditional Wedding",
    typeMatch: 'wedding',
    text: "We are planning an intimate South Indian wedding in Chennai for 150 guests with a budget of ₹8 lakh. Traditional temple aesthetic, classical Carnatic music, and authentic banana leaf feast.",
  },
  {
    id: 'community',
    label: "Diwali Community Mela",
    typeMatch: 'community',
    text: "Organizing a Diwali festival celebration for our apartment society in Pune. Around 200 residents, budget ₹1 lakh. Need stage setup for kids performances, rangoli contest, and evening snacks counter.",
  },
  {
    id: 'hinglish',
    label: "Family Engagement (Hinglish)",
    typeMatch: 'engagement',
    text: "Mere bhai ki engagement party plan karni hai Delhi mein. Around 100 log honge, budget 2.5 lakh max. Accha DJ chahiye for Bollywood dance, mast north Indian buffet dinner aur sundar pastel floral decor.",
  },
];

function formatErrorMessage(err: ClientError): string {
  if (err.code === 'rate_limited') {
    const secs = err.retryAfterSeconds ?? 60;
    return `AI generation rate limit reached. Please wait ${secs} seconds before trying again.`;
  }
  if (err.code === 'ai_unavailable') {
    return 'The AI celebration service is temporarily unavailable. Please try again shortly.';
  }
  if (err.code === 'network') {
    return 'Network connection failure. Please check your internet connectivity and retry.';
  }
  return err.message || 'Something went wrong while synthesizing your celebration plan.';
}

function getInitialBrief(typeParam: string): { chipId: string | null; text: string } {
  if (!typeParam || typeParam === 'default') return { chipId: null, text: '' };
  const match = SAMPLE_BRIEFS.find((b) => b.typeMatch === typeParam.toLowerCase());
  return match ? { chipId: match.id, text: match.text } : { chipId: null, text: '' };
}

function IntakeFormContent({ initialType }: { initialType: string }) {
  const router = useRouter();
  const initial = getInitialBrief(initialType);
  const { announce } = useAnnouncer();
  const createEvent = useEventsStore((s) => s.createEvent);

  const [text, setText] = useState<string>(initial.text);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(initial.chipId);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<ClientError | null>(null);

  const handleChipSelect = (chip: SampleChip) => {
    setSelectedChipId(chip.id);
    setText(chip.text);
    setError(null);
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || !text.trim()) return;

    setIsSubmitting(true);
    setError(null);
    announce('Creating your plan');

    try {
      const res = await submitIntake(text.trim());
      if (!res.ok) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      const { plan, fit, assumptions, missingInfo } = res.value;
      const finalAssumptions = fit.fits
        ? assumptions
        : ['This budget is below the minimum we can estimate for this event', ...assumptions];

      const eventId = createEvent(plan, { assumptions: finalAssumptions, missingInfo });
      router.push(`/events/${eventId}/concepts`);
    } catch {
      setError({ code: 'network', message: 'Failed to process request' });
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <Alert
          tone="danger"
          title="Plan Generation Notice"
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => handleSubmit()}>
              Retry
            </Button>
          }
        >
          {formatErrorMessage(error)}
        </Alert>
      ) : null}

      <div>
        <span className="text-xs font-semibold text-[#5B4A5E] uppercase tracking-wider block mb-2">
          Or start with a sample celebration brief:
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sample briefs">
          {SAMPLE_BRIEFS.map((chip) => {
            const isSelected = selectedChipId === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleChipSelect(chip)}
                aria-pressed={isSelected}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer font-medium ${
                  isSelected
                    ? 'bg-[#6B2D5C] text-white border-[#6B2D5C] shadow-xs'
                    : 'bg-white text-[#2B1B2E] border-[#E6DCD2] hover:bg-[#F4EDE6]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <Field
        label="Describe your celebration"
        hint="Include guest count, city, budget and what matters most. English, Hindi and Hinglish all work."
        required
      >
        <TextArea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          rows={6}
          maxLength={1500}
          showCount
          placeholder="e.g. Planning my parents' 25th anniversary in Mumbai for 80 guests. Budget is ₹1.5 lakh. They love old Bollywood music, elegant decor, and traditional food..."
          required
        />
      </Field>

      <p className="text-xs text-[#5B4A5E] leading-relaxed bg-[#F4EDE6]/60 p-3 rounded-[10px] border border-[#E6DCD2]/60">
        <strong className="font-semibold text-[#2B1B2E]">Privacy notice:</strong> Plans are stored in this browser.
        The text you send is processed by the AI service to generate ideas. Please don&apos;t include guest names or personal details.
      </p>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting}
          disabled={!text.trim() || isSubmitting}
          icon={<Icon name="sparkle" size={18} aria-hidden="true" />}
        >
          {isSubmitting ? 'Creating your plan...' : 'Synthesize Plan'}
        </Button>
      </div>
    </form>
  );
}

function IntakeFormWrapper() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') ?? 'default';
  return <IntakeFormContent key={type} initialType={type} />;
}

export function IntakeForm() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-12 w-36 ml-auto" />
        </div>
      }
    >
      <IntakeFormWrapper />
    </Suspense>
  );
}
