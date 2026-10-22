import type { Metadata } from 'next';
import { OverviewClient } from '@/components/overview/OverviewClient';

export const metadata: Metadata = {
  title: 'Event Overview',
};

export default function EventOverviewPage() {
  return <OverviewClient />;
}
