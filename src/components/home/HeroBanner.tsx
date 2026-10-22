'use client';

import { useRouter } from 'next/navigation';
import { Button, LinkButton } from '@/components/ui/Button';
import { CoverArt } from '@/components/ui/CoverArt';
import { Icon } from '@/components/ui/Icon';
import { useEventsStore } from '@/store/eventsStore';

export function HeroBanner() {
  const router = useRouter();
  const createDemoEvent = useEventsStore((s) => s.createDemoEvent);

  const handleLoadDemo = () => {
    const id = createDemoEvent();
    router.push(`/events/${id}/concepts`);
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative rounded-[20px] overflow-hidden border border-[#E6DCD2] bg-[#2B1B2E] text-white shadow-md p-6 sm:p-10 mb-8"
    >
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <CoverArt seed="hero_momently_banner" height={320} className="w-full h-full object-cover" />
      </div>

      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#D4A24C] border border-[#D4A24C]/30 text-xs font-semibold mb-4 tracking-wide uppercase">
          <Icon name="sparkle" size={14} aria-hidden="true" />
          <span>Celebration Intelligence Studio</span>
        </div>

        <h1
          id="hero-heading"
          className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.15]"
        >
          Plan better celebrations
        </h1>

        <p className="mt-4 text-base sm:text-lg text-[#F4EDE6] leading-relaxed max-w-xl">
          Your AI event director: from a vague idea to a plan that survives real life.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <LinkButton
            href="/new"
            variant="primary"
            size="md"
            className="bg-[#D4A24C] text-[#2B1B2E] hover:bg-[#e0b25d] border-transparent font-semibold shadow-sm"
            icon={<Icon name="plus" size={18} aria-hidden="true" />}
          >
            Plan a new event
          </LinkButton>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleLoadDemo}
            className="bg-white/15 text-white hover:bg-white/25 border-white/30 backdrop-blur-xs font-medium"
            icon={<Icon name="sparkle" size={18} aria-hidden="true" />}
          >
            Load the demo event
          </Button>
        </div>
      </div>
    </section>
  );
}
