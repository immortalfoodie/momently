import type { Metadata } from 'next';
import { PageContainer } from '@/components/ui/PageContainer';
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
    'Plan and stress-test celebrations with real-time budget, vendor, and contingency guidance.',
};

export default function HomePage() {
  return (
    <PageContainer width="full">
      <HeroBanner />
      <MyEvents />
      <QuickTools />
      <EventTypes />
      <HowItDecides />
    </PageContainer>
  );
}
