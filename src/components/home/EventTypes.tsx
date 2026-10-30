import Link from 'next/link';
import { getTemplate } from '@/data/templates';
import type { EventType } from '@/domain/types';
import { Icon } from '@/components/ui/Icon';

interface EventTypeInfo {
  type: EventType;
  title: string;
  tagline: string;
}

const EVENT_TYPES: EventTypeInfo[] = [
  {
    type: 'wedding',
    title: 'Wedding',
    tagline: 'Multi-function sangeet, wedding ceremony, and gala banquet planning',
  },
  {
    type: 'birthday',
    title: 'Birthday',
    tagline: 'Themed decor, high-energy party games, custom cake, and entertainment',
  },
  {
    type: 'anniversary',
    title: 'Silver / Golden Jubilee',
    tagline: 'Nostalgic family tributes, golden memories, music, and refined dining',
  },
  {
    type: 'community',
    title: 'Community & Society',
    tagline: 'High-turnout cultural gatherings, festive stalls, and community coordination',
  },
];

export function EventTypes() {
  return (
    <section aria-labelledby="event-types-heading" className="mb-12">
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5A00]">A GOOD PLACE TO BEGIN</p>
        <h2
          id="event-types-heading"
          className="mt-1 font-serif text-2xl font-bold text-[#2B1B2E]"
        >
          What are you celebrating?
        </h2>
        <p className="text-sm text-[#5B4A5E] mt-0.5">
          Select an event format to launch a pre-configured template with tailored pricing.
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
              className="group flex h-full flex-col rounded-[16px] border border-[#E6DCD2] bg-white p-5 text-inherit no-underline shadow-[0_2px_8px_rgba(43,27,46,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#6B2D5C]/40 hover:shadow-[0_12px_26px_rgba(43,27,46,0.08)]"
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#F4EDE6] text-[#6B2D5C]">
                    <Icon name={item.type === 'wedding' ? 'sparkle' : item.type === 'birthday' ? 'bulb' : item.type === 'anniversary' ? 'calendar' : 'users'} size={19} aria-hidden="true" />
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E6DCD2] text-[#6B2D5C] transition-all group-hover:border-[#6B2D5C] group-hover:bg-[#6B2D5C] group-hover:text-white" aria-hidden="true">
                    <Icon name="chevron-right" size={16} />
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-[#2B1B2E] transition-colors group-hover:text-[#6B2D5C]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5B4A5E]">
                  {item.tagline}
                </p>
              </div>

              <div className="mt-auto border-t border-[#E6DCD2]/70 pt-4">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">
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
