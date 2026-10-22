import type { Metadata } from 'next';
import {
  EventTypes,
  HeroBanner,
  HowItDecides,
  MyEvents,
  QuickTools,
} from '@/components/home';

export const metadata: Metadata = {
  title: 'Momently Celebration Studio',
  description:
    'Plan, stress-test, and orchestrate milestone celebrations with real-time budget, vendor, and contingency intelligence.',
};

export default function HomePage() {
  return (
    <div className="py-2">
      <HeroBanner />
      <MyEvents />
      <QuickTools />
      <EventTypes />
      <HowItDecides />
    </div>
  );
}
