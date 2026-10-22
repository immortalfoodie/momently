import type { Metadata } from 'next';
import { ConceptsClient } from '@/components/concepts';

export const metadata: Metadata = {
  title: 'Celebration Concepts',
  description: 'Evaluate aesthetic directions with live pricing, custom palettes, and trade-offs.',
};

/**
 * ConceptsPage route hosting the interactive concept studio.
 */
export default function ConceptsPage() {
  return <ConceptsClient />;
}
