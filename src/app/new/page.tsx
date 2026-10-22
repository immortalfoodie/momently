import type { Metadata } from 'next';
import { IntakeForm } from '@/components/intake';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Plan a New Event',
  description:
    'Describe your celebration in plain words. Momently synthesizes a complete, constraint-checked plan with tailored options.',
};

export default function NewEventPage() {
  return (
    <div className="py-2 max-w-3xl mx-auto">
      <PageHeader
        title="Vibe-to-Vision Intake"
        description="Share a few details about your celebration vision. Momently balances your guest count, city pricing, and creative aesthetic into an executable plan."
      />

      <div className="bg-white rounded-[20px] border border-[#E6DCD2] p-6 sm:p-8 shadow-xs">
        <IntakeForm />
      </div>
    </div>
  );
}
