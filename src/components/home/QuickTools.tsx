'use client';

import Link from 'next/link';
import type { IconName } from '@/components/ui/Icon';
import { Icon } from '@/components/ui/Icon';
import { useEventList } from '@/store/selectors';

interface ToolItem {
  title: string;
  description: string;
  icon: IconName;
  getHref: (recentEventId?: string) => string;
}

const TOOLS: ToolItem[] = [
  {
    title: 'New Celebration',
    description: 'Transform a brief into a structured, checked plan',
    icon: 'plus',
    getHref: () => '/new',
  },
  {
    title: 'Budget Guardian',
    description: 'Track rupee allocations, caps, and cost-saving choices',
    icon: 'wallet',
    getHref: (id) => (id ? `/events/${id}/budget` : '/new'),
  },
  {
    title: 'Execution Checklist',
    description: 'Vendor tasks, deadlines, and booked requirements',
    icon: 'checklist',
    getHref: (id) => (id ? `/events/${id}/checklist` : '/new'),
  },
  {
    title: 'Timeline & Delays',
    description: 'Event run-of-show with auto-cascading schedule adjustments',
    icon: 'clock',
    getHref: (id) => (id ? `/events/${id}/timeline` : '/new'),
  },
];

export function QuickTools() {
  const events = useEventList();
  const mostRecentId = events[0]?.plan.id;

  return (
    <section aria-labelledby="quick-tools-heading" className="mb-12">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5A00]">THE DETAILS, TAKEN CARE OF</p>
          <h2 id="quick-tools-heading" className="mt-1 font-serif text-2xl font-bold text-[#2B1B2E]">
            Keep every moving part in view
          </h2>
        </div>
        <p className="max-w-md text-sm text-[#5B4A5E]">A clear home for the decisions that make a celebration feel effortless.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TOOLS.map((tool) => {
          const href = tool.getHref(mostRecentId);
          return (
            <Link
              key={tool.title}
              href={href}
              className="group flex min-h-[174px] flex-col justify-between rounded-[16px] border border-[#E6DCD2] bg-white p-5 text-inherit no-underline shadow-[0_2px_8px_rgba(43,27,46,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#6B2D5C]/40 hover:shadow-[0_12px_26px_rgba(43,27,46,0.08)]"
            >
              <div>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#F4EDE6] text-[#6B2D5C] transition-colors group-hover:bg-[#6B2D5C] group-hover:text-white">
                  <Icon name={tool.icon} size={18} aria-hidden="true" />
                </div>
                <h3 className="font-serif text-base font-bold text-[#2B1B2E] transition-colors group-hover:text-[#6B2D5C]">
                  {tool.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5B4A5E]">
                  {tool.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#E6DCD2]/70 pt-3 text-xs font-semibold text-[#6B2D5C]">
                <span>Open workspace</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F4EDE6] transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                  <Icon name="chevron-right" size={15} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
