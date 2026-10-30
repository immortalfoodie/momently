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
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-warning">A GOOD PLACE TO BEGIN</p>
        <h2
          id="event-types-heading"
          className="mt-1 font-serif text-2xl font-bold text-ink"
        >
          What are you celebrating?
        </h2>
        <p className="text-sm text-ink-muted mt-0.5">
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
              className="group flex h-full flex-col rounded-[16px] border border-border bg-white p-5 text-inherit no-underline shadow-[0_2px_8px_rgba(43,27,46,0.03)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_26px_rgba(43,27,46,0.08)]"
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-surface-muted text-primary">
                    <Icon name={item.type === 'wedding' ? 'sparkle' : item.type === 'birthday' ? 'bulb' : item.type === 'anniversary' ? 'calendar' : 'users'} size={19} aria-hidden="true" />
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-white" aria-hidden="true">
                    <Icon name="chevron-right" size={16} />
                  </span>
                </div>
                <h3 className="font-serif text-lg font-bold text-ink transition-colors group-hover:text-primary">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                  {item.tagline}
                </p>
              </div>

              <div className="mt-auto border-t border-border/70 pt-4">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-warning">
                  Popular aesthetics
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-medium bg-surface-muted text-ink px-2 py-0.5 rounded-full border border-border/70"
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
