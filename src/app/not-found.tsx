import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Page Not Found',
};

export default function NotFound() {
  return (
    <div className="py-8">
      <PageHeader
        title="Page Not Found"
        description="The celebration workspace or route you are looking for could not be found."
      />
      <EmptyState
        icon={<Icon name="alert" size={28} aria-hidden="true" />}
        title="Destination Missing"
        description="This event workspace may have been moved, renamed, or does not exist."
        action={
          <LinkButton href="/" variant="primary">
            Return to Studio Home
          </LinkButton>
        }
      />
    </div>
  );
}
