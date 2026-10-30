'use client';

import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTourStore } from '@/store/tourStore';

export function HeroBanner() {
  const startTour = useTourStore((s) => s.start);

  const handleWatchDemo = () => {
    startTour();
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="home-hero relative isolate mb-10 overflow-hidden rounded-[24px] bg-[#2B1B2E] text-white shadow-[0_20px_55px_rgba(43,27,46,0.16)]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full border border-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-16 h-72 w-72 rounded-full border border-[#D4A24C]/20" />

      <div className="home-hero-layout relative grid gap-10 px-6 py-9 sm:px-10 sm:py-12">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#F0C978]">
            <Icon name="sparkle" size={14} aria-hidden="true" />
            <span>MADE FOR THE MOMENTS THAT MATTER</span>
          </div>

          <h1
            id="hero-heading"
            className="max-w-xl font-serif text-[clamp(2.35rem,6cqi,3.75rem)] font-semibold leading-[1.05] tracking-tight text-white"
          >
            Big moments deserve a <span className="text-[#F0C978]">better plan.</span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            Turn your idea into a celebration plan with a budget that adds up, a timeline that flows, and room for the unexpected.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton
              href="/new"
              variant="primary"
              size="md"
              className="border-transparent bg-[#F0C978] font-semibold text-[#2B1B2E] shadow-sm hover:bg-[#F6D995]"
              icon={<Icon name="plus" size={18} aria-hidden="true" />}
            >
              Start your plan
            </LinkButton>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleWatchDemo}
              className="border-white/25 bg-white/[0.08] font-medium text-white hover:bg-white/[0.15]"
              icon={<Icon name="sparkle" size={18} aria-hidden="true" />}
            >
              Watch the demo
            </Button>
          </div>

          <p className="mt-5 text-xs font-medium text-white/55">
            Weddings · birthdays · anniversaries · community gatherings
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[440px] lg:mx-0 lg:ml-auto">
          <div className="absolute -inset-3 -rotate-2 rounded-[24px] bg-[#D4A24C]/15" aria-hidden="true" />
          <div className="relative rounded-[20px] border border-white/70 bg-[#FFFCF8] p-5 text-[#2B1B2E] shadow-[0_18px_45px_rgba(0,0,0,0.24)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A5A00]">Your planning companion</p>
                <h2 className="mt-1 font-serif text-xl font-bold sm:text-2xl">Every detail, in sync</h2>
              </div>
              <span className="rounded-full bg-[#E7F4EE] px-2.5 py-1 text-[11px] font-semibold text-[#1F6F54]">All connected</span>
            </div>

            <div className="mt-5 rounded-[14px] bg-[#F4EDE6] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Budget with a clear cap</span>
                <Icon name="wallet" size={17} className="text-[#6B2D5C]" aria-hidden="true" />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full w-[68%] rounded-full bg-[#6B2D5C]" />
              </div>
              <p className="mt-2 text-xs text-[#5B4A5E]">Trade-offs stay visible before you commit</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-[#E6DCD2] p-3.5">
                <Icon name="calendar" size={17} className="text-[#6B2D5C]" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold">A timeline that flows</p>
                <p className="mt-0.5 text-xs text-[#5B4A5E]">Buffers built in</p>
              </div>
              <div className="rounded-[14px] border border-[#E6DCD2] p-3.5">
                <Icon name="storm" size={17} className="text-[#6B2D5C]" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold">Ready for real life</p>
                <p className="mt-0.5 text-xs text-[#5B4A5E]">Backups for what if</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-[#E6DCD2] pt-3 text-xs font-medium text-[#5B4A5E]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E7F4EE] text-[#1F6F54]">
                <Icon name="check" size={12} aria-hidden="true" />
              </span>
              You review every change before it becomes part of the plan
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
