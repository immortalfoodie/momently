import Link from 'next/link';
import type { EventPlan } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CoverArt } from '@/components/ui/CoverArt';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PaletteSwatches } from '@/components/ui/PaletteSwatches';

export interface ConceptSummaryCardProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

/**
 * ConceptSummaryCard presents the aesthetic direction chosen by the host.
 * WHY: Answers "What does this celebration feel like?" and provides quick access to alternative vibes.
 */
export function ConceptSummaryCard({
  plan,
  eventId,
  className = '',
}: ConceptSummaryCardProps) {
  const concept = plan.concepts.find((c) => c.id === plan.selectedConceptId);

  if (!concept) {
    return (
      <Card className={`p-6 bg-white border border-[#E6DCD2] ${className}`}>
        <EmptyState
          icon={<Icon name="sparkle" size={28} className="text-[#6B2D5C]" aria-hidden="true" />}
          title="No aesthetic concept selected"
          description="Explore curated themes tailored to your celebration style, palette, and budget."
          action={
            <Link href={`/events/${eventId}/concepts`}>
              <Button variant="primary">Explore Concepts</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden bg-white border border-[#E6DCD2] flex flex-col md:flex-row ${className}`}>
      <div className="w-full md:w-56 shrink-0 relative bg-[#F4EDE6]">
        <CoverArt seed={concept.title} palette={concept.palette} height={200} className="w-full h-full object-cover" />
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">{concept.title}</h3>
            <Link href={`/events/${eventId}/concepts`}>
              <Button variant="secondary" size="sm">
                Change concept
              </Button>
            </Link>
          </div>
          <p className="text-xs font-medium text-[#6B2D5C] italic">{concept.tagline}</p>
          <p className="text-xs text-[#5B4A5E] leading-relaxed">{concept.summary}</p>
        </div>

        <div className="space-y-2 pt-2 border-t border-[#F4EDE6]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5B4A5E] uppercase tracking-wider">
              Signature Palette
            </span>
            <PaletteSwatches palette={concept.palette} />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#5B4A5E] uppercase tracking-wider">
              Experience Highlights
            </span>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[#2B1B2E]">
              {concept.experienceHighlights.map((hl, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <Icon name="check" size={12} className="text-[#1F6F54] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{hl}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
