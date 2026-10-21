import type { Metadata } from 'next';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'My Events',
};

export default function EventsPage() {
  return (
    <div className="py-2">
      <PageHeader
        title="My Celebrations"
        description="View and manage all active, drafted, and completed celebration workspaces."
        actions={
          <LinkButton
            href="/new"
            variant="primary"
            icon={<Icon name="plus" size={16} aria-hidden="true" />}
          >
            New Celebration
          </LinkButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8A5A00] bg-[#FFF4DC] px-2.5 py-0.5 rounded-full">
                Benchmark Demo
              </span>
              <span className="text-xs text-[#5B4A5E]">Mumbai</span>
            </div>
            <CardTitle level={2} className="mt-2">
              Parents&apos; 25th Anniversary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#5B4A5E]">
              80 guests · ₹1,50,000 budget cap · Retro Bollywood Theme
            </p>
          </CardContent>
          <CardFooter>
            <span className="text-xs text-[#5B4A5E]">100% in budget</span>
            <LinkButton href="/events/demo" variant="secondary" size="sm">
              Open Workspace
            </LinkButton>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
