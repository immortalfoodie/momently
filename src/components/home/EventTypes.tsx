import Link from 'next/link';
import { getTemplate } from '@/data/templates';
import type { EventType } from '@/domain/types';

interface EventTypeInfo {
  type: EventType;
  title: string;
  tagline: string;
}

const EVENT_TYPES: EventTypeInfo[] = [
  {
    type: 'wedding',
    title: 'Wedding',
    tagline: 'Multi-function sangeet, wedding ceremony, and gala banquet orchestration',
  },
  {
    type: 'birthday',
    title: 'Milestone Birthday',
    tagline: 'Themed decor, high-energy party games, custom cake, and entertainment',
  },
  {
    type: 'anniversary',
    title: 'Silver / Golden Jubilee',
    tagline: 'Nostalgic family tributes, golden memories, audio-visuals, and refined dining',
  },
  {
    type: 'community',
    title: 'Community & Society',
    tagline: 'High-turnout cultural gatherings, festive stage stalls, and crowd coordination',
  },
];

export function EventTypes() {
  return (
    <section aria-labelledby="event-types-heading" className="mb-10">
      <div className="mb-4">
        <h2
          id="event-types-heading"
          className="font-serif text-2xl font-bold text-[#2B1B2E]"
        >
          What are you celebrating?
        </h2>
        <p className="text-sm text-[#5B4A5E] mt-0.5">
          Select an event format to launch a pre-configured template with tailored rate cards.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {EVENT_TYPES.map((item) => {
          const template = getTemplate(item.type);
          const tags = template.styleSuggestions.slice(0, 3);

          return (
            <Link
              key={item.type}
              href={`/new?type=${item.type}`}
              className="bg-white rounded-[16px] border border-[#E6DCD2] p-5 shadow-2xs hover:border-[#6B2D5C] hover:shadow-xs transition-all no-underline text-inherit group flex flex-col justify-between"
            >
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2B1B2E] group-hover:text-[#6B2D5C] transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-[#5B4A5E] mt-1.5 leading-relaxed">
                  {item.tagline}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E6DCD2]/60">
                <span className="text-[11px] font-semibold text-[#5B4A5E] uppercase tracking-wider block mb-2">
                  Popular aesthetics
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-medium bg-[#F4EDE6] text-[#2B1B2E] px-2 py-0.5 rounded-full border border-[#E6DCD2]/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
