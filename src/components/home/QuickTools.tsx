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
    description: 'Track rupee allocations, caps, and cost-saving levers',
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
    <section aria-labelledby="quick-tools-heading" className="mb-10">
      <h2
        id="quick-tools-heading"
        className="font-serif text-xl font-bold text-[#2B1B2E] mb-4"
      >
        Quick Tools
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TOOLS.map((tool) => {
          const href = tool.getHref(mostRecentId);
          return (
            <Link
              key={tool.title}
              href={href}
              className="bg-white rounded-[14px] border border-[#E6DCD2] p-4 shadow-2xs hover:border-[#6B2D5C]/50 hover:shadow-xs transition-all no-underline text-inherit group flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-[10px] bg-[#F4EDE6] text-[#6B2D5C] flex items-center justify-center mb-3 group-hover:bg-[#6B2D5C] group-hover:text-white transition-colors">
                  <Icon name={tool.icon} size={18} aria-hidden="true" />
                </div>
                <h3 className="font-serif text-sm font-bold text-[#2B1B2E] group-hover:text-[#6B2D5C] transition-colors">
                  {tool.title}
                </h3>
                <p className="text-xs text-[#5B4A5E] mt-1 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="mt-3 flex items-center text-xs font-semibold text-[#6B2D5C] pt-2 border-t border-[#E6DCD2]/50">
                <span>Open tool</span>
                <Icon name="chevron-right" size={14} className="ml-1" aria-hidden="true" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
