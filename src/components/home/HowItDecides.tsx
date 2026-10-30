import { Icon } from '@/components/ui/Icon';

const POINTS = [
  {
    icon: 'sparkle' as const,
    title: '1. The AI suggests',
    description:
      'Generates creative aesthetics, tailored menus, and contingency concepts from plain conversation.',
  },
  {
    icon: 'wallet' as const,
    title: '2. The engine checks the numbers',
    description:
      'Exact calculations verify every rupee, constraint, and schedule gap without guessing.',
  },
  {
    icon: 'check' as const,
    title: '3. You approve every change',
    description:
      'Zero silent alterations. You inspect preview diffs and explicitly approve every modification.',
  },
];

export function HowItDecides() {
  return (
    <section
      aria-labelledby="how-momently-decides-heading"
      className="rounded-[18px] border border-border bg-bg p-6 sm:p-8 mb-8"
    >
      <div className="text-center max-w-xl mx-auto mb-6">
        <h2
          id="how-momently-decides-heading"
          className="font-serif text-xl sm:text-2xl font-bold text-ink"
        >
          How Momently decides
        </h2>
        <p className="text-sm text-ink-muted mt-1">
          The core architecture separating generative creativity from mathematical truth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {POINTS.map((pt) => (
          <div
            key={pt.title}
            className="bg-white rounded-[14px] border border-border p-5 shadow-2xs flex flex-col items-start"
          >
            <div className="w-10 h-10 rounded-[10px] bg-surface-muted text-primary flex items-center justify-center mb-3">
              <Icon name={pt.icon} size={20} aria-hidden="true" />
            </div>
            <h3 className="font-serif text-base font-bold text-ink">
              {pt.title}
            </h3>
            <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
              {pt.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
