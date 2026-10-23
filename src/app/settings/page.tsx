import type { Metadata } from 'next';
import { SettingsClient } from '@/components/settings/SettingsClient';

export const metadata: Metadata = {
  title: 'Settings | Momently',
  description: 'AI mode, local data portability, and privacy controls.',
};

export default function SettingsPage() {
  return <SettingsClient />;
}
