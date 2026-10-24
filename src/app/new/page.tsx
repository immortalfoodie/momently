import type { Metadata } from 'next';
import { IntakeForm } from '@/components/intake';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { PAGE_COPY } from '@/lib/copy';

export const metadata: Metadata = {
  title: 'Plan a New Event',
  description:
    'Describe your celebration in plain words. Momently creates a complete, constraint-checked plan with tailored options.',
};

export default function NewEventPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader
        title={PAGE_COPY.new.title}
        description={PAGE_COPY.new.description}
      />

      <div className="bg-white rounded-[20px] border border-[#E6DCD2] p-6 sm:p-8 shadow-xs">
        <IntakeForm />
      </div>
    </PageContainer>
  );
}
